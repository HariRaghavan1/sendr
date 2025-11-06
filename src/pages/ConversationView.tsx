import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useConversation, Message } from "@/hooks/useConversation";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { WorkflowCard } from "@/components/WorkflowCard";
import { ExecutionMonitor } from "@/components/ExecutionMonitor";
import { TemplateCard } from "@/components/TemplateCard";
import { GmailConnectCard } from "@/components/GmailConnectCard";

const ConversationView = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { messages, setMessages, createConversation, saveMessage } = useConversation(conversationId);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentConvId, setCurrentConvId] = useState<string | undefined>(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hi! I'll help you create an email outreach campaign. What kind of prospects do you want to reach?"
      }]);
    }
  }, [conversationId]);

  useEffect(() => {
    setCurrentConvId(conversationId);
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    try {
      let convId = currentConvId;

      // Create conversation on first message
      if (!convId) {
        convId = await createConversation(userMessage);
        setCurrentConvId(convId);
        navigate(`/campaigns/ai-create/${convId}`, { replace: true });
      }

      // Add user message locally
      const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
      setMessages(newMessages);

      // Save user message
      if (convId) {
        await saveMessage(convId, 'user', userMessage);
      }

      // Add placeholder for streaming assistant message
      const assistantMessageIndex = newMessages.length;
      setMessages([...newMessages, { role: 'assistant', content: '' }]);

      // Stream response from edge function
      const session = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/campaign-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({
            messages: newMessages.filter(msg => msg && msg.content != null && msg.content !== '')
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to get response');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
let streamedContent = '';
let finalAssistantContent = '';
let accumulatedToolCalls: Map<number, any> = new Map();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            const newToolCalls = parsed.choices?.[0]?.delta?.tool_calls;

            if (content) {
              streamedContent += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[assistantMessageIndex] = {
                  role: 'assistant',
                  content: streamedContent
                };
                return updated;
              });
            }

            if (newToolCalls && Array.isArray(newToolCalls)) {
              for (const toolCall of newToolCalls) {
                const index = toolCall.index;
                if (!accumulatedToolCalls.has(index)) {
                  accumulatedToolCalls.set(index, {
                    id: toolCall.id || '',
                    type: toolCall.type || 'function',
                    function: {
                      name: toolCall.function?.name || '',
                      arguments: toolCall.function?.arguments || ''
                    }
                  });
                } else {
                  const existing = accumulatedToolCalls.get(index);
                  if (toolCall.id) existing.id = toolCall.id;
                  if (toolCall.type) existing.type = toolCall.type;
                  if (toolCall.function?.name) existing.function.name = toolCall.function.name;
                  if (toolCall.function?.arguments) {
                    existing.function.arguments += toolCall.function.arguments;
                  }
                }
              }
            }
          } catch {
            // Incomplete JSON, put it back
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

// Defer saving assistant message until after tool-call handling to include results


      // Handle tool calls
      const toolCallsArray = Array.from(accumulatedToolCalls.values());
      if (toolCallsArray.length > 0) {
        for (const toolCall of toolCallsArray) {
          if (toolCall.function?.name === 'create_campaign') {
            try {
              const config = JSON.parse(toolCall.function.arguments);
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              // Create a workflow (needed for the WorkflowCard and test runs)
              const workflowData = {
                name: config.name,
                description: `Campaign: ${config.name}`,
                target_criteria: config.target_criteria,
                tone: config.tone,
                goal: config.goal,
                instructions: config.custom_prompt || '',
                schedule: { frequency: 'daily', time: '09:00', batch_size: 25 },
                steps: [
                  { action: 'find_prospects', description: 'Find prospects matching criteria' },
                  { action: 'generate_email', description: 'Generate personalized emails' },
                  { action: 'send_email', description: 'Send emails to prospects' }
                ]
              };

              const { data: workflow, error: workflowError } = await supabase
                .from('workflows')
                .insert({
                  user_id: user.id,
                  conversation_id: convId,
                  name: config.name,
                  description: workflowData.description,
                  workflow_config: workflowData,
                  instructions: config.custom_prompt || '',
                  schedule_config: workflowData.schedule,
                  status: 'draft'
                })
                .select()
                .single();

              if (workflowError) throw workflowError;

              // Create the campaign
              const { data: campaign, error: campaignError } = await supabase
                .from('campaigns')
                .insert({
                  user_id: user.id,
                  name: config.name,
                  target_criteria: config.target_criteria,
                  tone: config.tone,
                  goal: config.goal,
                  custom_prompt: config.custom_prompt,
                  status: 'draft'
                })
                .select()
                .single();

              if (campaignError) throw campaignError;

              if (convId) {
                await supabase
                  .from('campaign_conversations')
                  .update({ campaign_id: campaign.id })
                  .eq('id', convId);
              }

              // Set message metadata to display WorkflowCard
              setMessages(prev => {
                const updated = [...prev];
                updated[assistantMessageIndex] = {
                  ...updated[assistantMessageIndex],
                  metadata: {
                    type: 'workflow',
                    workflowId: workflow.id,
                    workflowData
                  }
                };
                return updated;
              });

              toast({
                title: "Campaign created!",
                description: `"${config.name}" is ready. Click "Test Run" to test it.`,
              });

              finalAssistantContent = `Created campaign "${config.name}". Click "Test Run" below to test it with a small batch.`;

            } catch (error: any) {
              console.error('Error creating campaign:', error);
              toast({
                title: "Error creating campaign",
                description: error.message,
                variant: "destructive",
              });
            }
          } else if (toolCall.function?.name === 'create_workflow') {
            try {
              const workflowData = JSON.parse(toolCall.function.arguments);
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');
              
              // Save workflow to database
              const { data: workflow, error: workflowError } = await supabase
                .from('workflows')
                .insert({
                  user_id: user.id,
                  conversation_id: convId,
                  name: workflowData.name,
                  description: workflowData.description,
                  workflow_config: workflowData,
                  instructions: workflowData.instructions || '',
                  schedule_config: workflowData.schedule || { frequency: 'daily', time: '09:00', batch_size: 25 },
                  status: 'draft'
                })
                .select()
                .single();

              if (workflowError) {
                console.error('Error saving workflow:', workflowError);
              } else {
                workflowData.id = workflow.id;
              }
              
setMessages(prev => {
  const updated = [...prev];
  updated[assistantMessageIndex] = {
    ...updated[assistantMessageIndex],
    metadata: {
      type: 'workflow',
      workflowId: workflow?.id,
      workflowData
    }
  };
  return updated;
});

// Auto-create a campaign from the workflow so "create it" actually creates it
try {
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      user_id: user.id,
      name: workflowData.name,
      target_criteria: workflowData.target_criteria,
      tone: workflowData.tone || 'casual',
      goal: workflowData.goal,
      custom_prompt: workflowData.instructions,
      frequency_config: workflowData.schedule || { frequency: 'daily', time: '09:00', batch_size: 25 },
      status: 'draft'
    })
    .select()
    .single();

  if (campaignError) {
    console.error('Error creating campaign from workflow:', campaignError);
  } else {
    if (convId) {
      await supabase
        .from('campaign_conversations')
        .update({ campaign_id: campaign.id })
        .eq('id', convId);
    }

    toast({
      title: 'Campaign created!',
      description: `"${workflowData.name}" is ready. Click "Test Run" to test it.`,
    });

    finalAssistantContent = `Created campaign "${workflowData.name}" (ID: ${workflow?.id}). Click "Test Run" below to test it with a small batch.`;
  }
} catch (e) {
  console.error('Auto-create campaign error:', e);
}
            } catch (error) {
              console.error('Error parsing workflow:', error);
            }
          } else if (toolCall.function?.name === 'run_test') {
            try {
              const params = JSON.parse(toolCall.function.arguments);
              let { workflow_id, max_prospects = 5, skip_sending = true } = params;
              
              // Clamp max_prospects between 1 and 25
              max_prospects = Math.max(1, Math.min(25, max_prospects));
              
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              // Validate workflow_id is a UUID, if not try to look it up by name
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              
              if (!uuidRegex.test(workflow_id)) {
                console.log('Workflow ID is not a UUID, attempting lookup by name:', workflow_id);
                // Try to find workflow by name
                const { data: foundWorkflow, error: lookupError } = await supabase
                  .from('workflows')
                  .select('id')
                  .eq('user_id', user.id)
                  .eq('name', workflow_id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (lookupError || !foundWorkflow) {
                  throw new Error(`Workflow not found with name: "${workflow_id}". Please use the workflow ID instead.`);
                }
                
                workflow_id = foundWorkflow.id;
                console.log('Found workflow ID:', workflow_id);
              }

              // Find the campaign_id for this workflow by looking at the conversation
              const { data: conversation, error: convError } = await supabase
                .from('campaign_conversations')
                .select('campaign_id')
                .eq('id', convId)
                .single();

              if (convError || !conversation?.campaign_id) {
                throw new Error('Campaign not found for this workflow. Please create the campaign first.');
              }

              const campaign_id = conversation.campaign_id;

              // Create workflow execution
              const { data: execution, error: execError } = await supabase
                .from('workflow_executions')
                .insert({
                  workflow_id,
                  campaign_id,
                  user_id: user.id,
                  execution_type: 'manual',
                  status: 'running',
                  prospects_found: 0,
                  emails_generated: 0,
                  emails_sent: 0,
                })
                .select()
                .single();

              if (execError) throw execError;

              // Add ExecutionMonitor to chat
              const execMessage: Message = {
                role: 'assistant' as const,
                content: `Starting test run for ${max_prospects} prospect${max_prospects === 1 ? '' : 's'}...`,
                metadata: {
                  type: 'execution' as const,
                  executionId: execution.id
                }
              };
              setMessages(prev => [...prev, execMessage]);

              // Persist execution message to database so it survives page refreshes
              if (convId) {
                await saveMessage(
                  convId, 
                  'assistant', 
                  execMessage.content,
                  execMessage.metadata
                );
              }

              // Trigger execution with campaign_id, max_prospects and skip_sending
              supabase.functions.invoke('execute-workflow', {
                body: { 
                  workflow_id, 
                  campaign_id,
                  execution_id: execution.id,
                  max_prospects,
                  skip_sending
                }
              }).then(({ error }) => {
                if (error) {
                  console.error('Error executing workflow:', error);
                  toast({
                    title: "Execution Error",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              });

              finalAssistantContent = `Test run started for ${max_prospects} prospect${max_prospects === 1 ? '' : 's'}. See live progress below.`;
            } catch (error: any) {
              console.error('Error starting test run:', error);
              toast({
                title: "Error starting test",
                description: error.message,
                variant: "destructive",
              });
            }
          } else if (toolCall.function?.name === 'add_email_template') {
            try {
              const templateData = JSON.parse(toolCall.function.arguments);
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              const { data: template, error: templateError } = await supabase
                .from('email_templates')
                .insert({
                  user_id: user.id,
                  workflow_id: templateData.workflow_id,
                  name: templateData.name,
                  subject: templateData.subject,
                  body: templateData.body,
                  components: templateData.components || {}
                })
                .select()
                .single();

              if (templateError) throw templateError;

              // Add TemplateCard to chat
              setMessages(prev => {
                const updated = [...prev];
                updated[assistantMessageIndex] = {
                  ...updated[assistantMessageIndex],
                  metadata: {
                    type: 'template',
                    templateId: template.id,
                    templateData: template
                  }
                };
                return updated;
              });

              toast({
                title: "Template created!",
                description: `"${templateData.name}" is ready to use.`,
              });

              finalAssistantContent = `Created email template "${templateData.name}". You can now use this in your test runs.`;
            } catch (error: any) {
              console.error('Error creating template:', error);
              toast({
                title: "Error creating template",
                description: error.message,
                variant: "destructive",
              });
            }
          } else if (toolCall.function?.name === 'edit_email_template') {
            try {
              const { template_id, updates } = JSON.parse(toolCall.function.arguments);

              const { error: updateError } = await supabase
                .from('email_templates')
                .update(updates)
                .eq('id', template_id);

              if (updateError) throw updateError;

              // Update template in messages
              setMessages(prev => {
                const updated = [...prev];
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].metadata?.type === 'template' && updated[i].metadata?.templateId === template_id) {
                    updated[i] = {
                      ...updated[i],
                      metadata: {
                        ...updated[i].metadata,
                        templateData: {
                          ...updated[i].metadata!.templateData,
                          ...updates
                        }
                      }
                    };
                    break;
                  }
                }
                return updated;
              });

              toast({
                title: "Template updated",
                description: "Changes saved successfully.",
              });

              finalAssistantContent = "Template updated successfully.";
            } catch (error: any) {
              console.error('Error updating template:', error);
              toast({
                title: "Error updating template",
                description: error.message,
                variant: "destructive",
              });
            }
          } else if (toolCall.function?.name === 'update_workflow') {
            try {
              const { workflow_id, updates } = JSON.parse(toolCall.function.arguments);
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              // Update workflow in database
              const { error: workflowError } = await supabase
                .from('workflows')
                .update({
                  name: updates.name,
                  description: updates.description,
                  workflow_config: updates,
                  instructions: updates.instructions,
                  schedule_config: updates.schedule
                })
                .eq('id', workflow_id)
                .eq('user_id', user.id);

              if (workflowError) throw workflowError;

              // Update linked campaign
              const { data: conversation } = await supabase
                .from('campaign_conversations')
                .select('campaign_id')
                .eq('id', convId)
                .single();

              if (conversation?.campaign_id) {
                await supabase
                  .from('campaigns')
                  .update({
                    name: updates.name,
                    target_criteria: updates.target_criteria,
                    tone: updates.tone,
                    goal: updates.goal,
                    custom_prompt: updates.instructions,
                    frequency_config: updates.schedule
                  })
                  .eq('id', conversation.campaign_id)
                  .eq('user_id', user.id);
              }
              
              // Update UI
              setMessages(prev => {
                const updated = [...prev];
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].metadata?.type === 'workflow' && updated[i].metadata?.workflowData?.id === workflow_id) {
                    updated[i] = {
                      ...updated[i],
                      metadata: {
                        ...updated[i].metadata,
                        workflowData: {
                          ...updated[i].metadata!.workflowData,
                          ...updates
                        }
                      }
                    };
                    break;
                  }
                }
                return updated;
              });

              toast({
                title: "Campaign updated",
                description: "Changes saved successfully.",
              });

              finalAssistantContent = `Updated campaign: ${Object.keys(updates).join(", ")}`;
            } catch (error: any) {
              console.error('Error updating workflow:', error);
              toast({
                title: "Error updating campaign",
                description: error.message,
                variant: "destructive",
              });
            }
          } else if (toolCall.function?.name === 'update_campaign') {
            try {
              const { campaign_id, updates } = JSON.parse(toolCall.function.arguments);
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              // Update campaign in database
              const { error: campaignError } = await supabase
                .from('campaigns')
                .update({
                  ...updates,
                  updated_at: new Date().toISOString()
                })
                .eq('id', campaign_id)
                .eq('user_id', user.id);

              if (campaignError) throw campaignError;

              // Update linked workflow if exists
              const { data: workflow } = await supabase
                .from('workflows')
                .select('id')
                .eq('conversation_id', convId)
                .single();

              if (workflow) {
                await supabase
                  .from('workflows')
                  .update({
                    name: updates.name,
                    workflow_config: { ...updates },
                    instructions: updates.custom_prompt,
                    schedule_config: updates.frequency_config
                  })
                  .eq('id', workflow.id)
                  .eq('user_id', user.id);

                // Update workflow card in UI
                setMessages(prev => {
                  const updated = [...prev];
                  for (let i = updated.length - 1; i >= 0; i--) {
                    if (updated[i].metadata?.type === 'workflow' && updated[i].metadata?.workflowId === workflow.id) {
                      updated[i] = {
                        ...updated[i],
                        metadata: {
                          ...updated[i].metadata,
                          workflowData: {
                            ...updated[i].metadata!.workflowData,
                            ...updates
                          }
                        }
                      };
                      break;
                    }
                  }
                  return updated;
                });
              }

              toast({
                title: "Campaign updated",
                description: `Updated: ${Object.keys(updates).join(", ")}`,
              });

              finalAssistantContent = `Campaign updated successfully: ${Object.keys(updates).join(", ")}`;
            } catch (error: any) {
              console.error('Error updating campaign:', error);
              toast({
                title: "Error updating campaign",
                description: error.message,
                variant: "destructive",
              });
            }
          } else if (toolCall.function?.name === 'connect_gmail') {
            try {
              const { reason } = JSON.parse(toolCall.function.arguments);
              
              // Add special metadata to show Gmail connection button
              setMessages(prev => {
                const updated = [...prev];
                updated[assistantMessageIndex] = {
                  ...updated[assistantMessageIndex],
                  metadata: {
                    type: 'gmail_connect',
                    reason
                  }
                };
                return updated;
              });

              finalAssistantContent = `${reason}\n\nClick the button below to connect your Gmail account:`;
            } catch (error: any) {
              console.error('Error handling connect_gmail:', error);
              finalAssistantContent = 'To send emails, you need to connect your Gmail account. Click the button below to get started.';
            }
          }
        }
      }

      // Persist assistant message after processing tool calls
      if (convId) {
        const contentToSave = finalAssistantContent || streamedContent || 'I can help you create a campaign.';
        await saveMessage(convId, 'assistant', contentToSave);
      }

    } catch (error: any) {
      console.error('Error in chat:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: error.message || 'Sorry, I encountered an error. Please try again.'
      }]);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">AI Campaign Creator</h1>
              <p className="text-xs text-muted-foreground">Create campaigns through conversation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {messages.filter(msg => msg && msg.role).map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && message.metadata?.type === 'gmail_connect' ? (
                <div className="max-w-[90%] space-y-3">
                  <GmailConnectCard reason={message.metadata.reason} />
                  {message.content && (
                    <div className="bg-card border border-border rounded-2xl px-5 py-3.5 shadow-sm">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                    </div>
                  )}
                </div>
              ) : message.role === 'assistant' && message.metadata?.type === 'template' ? (
                <div className="max-w-[90%] space-y-3">
                  <TemplateCard template={message.metadata.templateData} />
                </div>
              ) : message.role === 'assistant' && message.metadata?.type === 'workflow' ? (
                <div className="max-w-[90%] space-y-3">
                  <WorkflowCard
                    workflow={message.metadata.workflowData}
                    onEdit={() => {
                      setInput(`Update the workflow: `);
                    }}
                    onTestRun={async () => {
                      const workflowId = message.metadata?.workflowId;
                      if (!workflowId) {
                        toast({
                          title: "Error",
                          description: "Workflow not saved yet",
                          variant: "destructive",
                        });
                        return;
                      }

                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error('Not authenticated');

                        // Create workflow execution record
                        const { data: execution, error: execError } = await supabase
                          .from('workflow_executions')
                          .insert({
                            workflow_id: workflowId,
                            user_id: user.id,
                            execution_type: 'manual',
                            status: 'running',
                            prospects_found: 0,
                            emails_generated: 0,
                            emails_sent: 0,
                          })
                          .select()
                          .single();

                        if (execError) throw execError;

                        // Add ExecutionMonitor message to chat
                        const executionMessage: Message = {
                          role: 'assistant',
                          content: `Starting test run for workflow: ${message.metadata.workflowData.name}`,
                          metadata: {
                            type: 'execution',
                            executionId: execution.id,
                          },
                        };
                        
                        setMessages(prev => [...prev, executionMessage]);

                        // Persist execution message to database
                        if (currentConvId) {
                          await saveMessage(
                            currentConvId, 
                            'assistant', 
                            executionMessage.content,
                            executionMessage.metadata
                          );
                        }

                        // Call execute-workflow edge function (fire and forget)
                        supabase.functions.invoke('execute-workflow', {
                          body: {
                            workflow_id: workflowId,
                            execution_id: execution.id,
                          },
                        }).then(({ error }) => {
                          if (error) {
                            console.error('Error executing workflow:', error);

                            // Check if error is due to function not being deployed
                            const isDeploymentError = error.message?.includes('404') ||
                                                     error.message?.includes('not found') ||
                                                     error.message?.includes('FunctionsRelayError');

                            toast({
                              title: isDeploymentError ? "Edge Function Not Deployed" : "Execution Error",
                              description: isDeploymentError
                                ? "The execute-workflow function hasn't been deployed to Supabase. Please deploy it using: supabase functions deploy execute-workflow"
                                : error.message,
                              variant: "destructive",
                            });
                          }
                        });

                        toast({
                          title: "Test run started",
                          description: `Running test for workflow: ${message.metadata.workflowData.name}`,
                        });

                      } catch (error: any) {
                        toast({
                          title: "Error",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                    onDeploy={async () => {
                      const workflowData = message.metadata?.workflowData;
                      const workflowId = message.metadata?.workflowId;
                      
                      if (!workflowData || !workflowId) {
                        toast({
                          title: "Error",
                          description: "Workflow data not available",
                          variant: "destructive",
                        });
                        return;
                      }

                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error('Not authenticated');

                        const { error: campaignError } = await supabase
                          .from('campaigns')
                          .insert({
                            user_id: user.id,
                            name: workflowData.name,
                            target_criteria: workflowData.target_criteria,
                            tone: workflowData.tone,
                            goal: workflowData.goal,
                            custom_prompt: workflowData.instructions,
                            frequency_config: workflowData.schedule || { frequency: 'daily', time: '09:00', batch_size: 25 },
                            status: 'active'
                          })
                          .select()
                          .single();

                        if (campaignError) throw campaignError;

                        await supabase
                          .from('workflows')
                          .update({ status: 'active' })
                          .eq('id', workflowId);

                        toast({
                          title: "Campaign deployed!",
                          description: `"${workflowData.name}" is now active. View it in your campaigns list.`,
                        });
                      } catch (error: any) {
                        console.error('Error deploying workflow:', error);
                        toast({
                          title: "Error deploying campaign",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                  />
                   {message.content && (
                    <div className="bg-card border border-border rounded-2xl px-5 py-3.5 shadow-sm">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                    </div>
                  )}
                </div>
              ) : message.role === 'assistant' && message.metadata?.type === 'execution' ? (
                <div className="max-w-[90%]">
                  <ExecutionMonitor executionId={message.metadata.executionId!} />
                </div>
              ) : (
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl px-5 py-3.5 shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your campaign goals, target audience, and message..."
              className="min-h-[60px] max-h-[200px] resize-none bg-background"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={loading || !input.trim()}
              className="h-[60px] w-[60px] shrink-0 rounded-xl"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift + Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
};

export default ConversationView;
