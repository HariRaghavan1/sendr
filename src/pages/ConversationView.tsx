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

  // Real-time subscription for new messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new as any;
          setMessages(prev => {
            // Check if message already exists by ID or by content+role+timestamp to prevent duplicates
            const existsById = newMessage.id && prev.some((m: any) => m.id === newMessage.id);
            if (existsById) return prev;
            
            // Also check for content duplicates in recent messages (last 3)
            const recentMessages = prev.slice(-3);
            const existsByContent = recentMessages.some((m: any) => 
              m.role === newMessage.role && 
              m.content === newMessage.content
            );
            if (existsByContent) return prev;
            
            return [...prev, newMessage];
          });
          
          if (newMessage.metadata?.type === 'execution_complete') {
            toast({
              title: "Execution Complete",
              description: `Found ${newMessage.metadata.stats?.prospects_found || 0} prospects, generated ${newMessage.metadata.stats?.emails_generated || 0} emails`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

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

      // Save user message to DB first (real-time subscription will add it to UI)
      if (convId) {
        const { error } = await supabase
          .from('conversation_messages')
          .insert({
            conversation_id: convId,
            role: 'user',
            content: userMessage
          });
        
        if (error) {
          console.error('Error saving user message:', error);
          // Fallback: add locally if DB save fails
          setMessages(prev => [...prev, { role: 'user' as const, content: userMessage }]);
        }
      } else {
        // No conversation yet, add locally
        setMessages(prev => [...prev, { role: 'user' as const, content: userMessage }]);
      }

      // Wait a moment for real-time subscription to add the user message
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get current messages state (may have been updated by real-time subscription)
      // Use a function to get the latest messages state
      let assistantMessageIndex: number;
      let currentMessagesForAPI: Message[];
      
      setMessages(prev => {
        assistantMessageIndex = prev.length;
        currentMessagesForAPI = prev.length > 0 ? prev : [{ role: 'user' as const, content: userMessage }];
        // Add placeholder for streaming assistant message
        return [...prev, { role: 'assistant' as const, content: '' }];
      });

      // Stream response from edge function
      const session = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured. Please check your environment variables.');
      }

      let response: Response;
      try {
        response = await fetch(
          `${supabaseUrl}/functions/v1/campaign-chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.data.session?.access_token}`,
            },
            body: JSON.stringify({
              messages: currentMessagesForAPI.filter(msg => msg && msg.content != null && msg.content !== '')
            }),
          }
        );
      } catch (fetchError: any) {
        // Network error - function probably not deployed
        if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
          throw new Error('Edge function not deployed or unreachable. Please deploy the campaign-chat function in your Supabase dashboard.');
        }
        throw fetchError;
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('campaign-chat function not found. Please deploy it in your Supabase dashboard.');
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || `Failed to get response (${response.status})`);
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

              // Map tone values: "professional" -> "formal" (database enum only accepts 'formal', 'casual', 'witty')
              const toneMap: Record<string, 'formal' | 'casual' | 'witty'> = {
                'professional': 'formal',
                'formal': 'formal',
                'casual': 'casual',
                'witty': 'witty'
              };
              const mappedTone = toneMap[config.tone?.toLowerCase()] || 'casual';

              // Create the campaign
              const { data: campaign, error: campaignError } = await supabase
                .from('campaigns')
                .insert({
                  user_id: user.id,
                  name: config.name,
                  target_criteria: config.target_criteria,
                  tone: mappedTone,
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

              // Set message metadata to display WorkflowCard with Test Run button
              setMessages(prev => {
                const updated = [...prev];
                if (updated[assistantMessageIndex]) {
                  updated[assistantMessageIndex] = {
                    ...updated[assistantMessageIndex],
                    metadata: {
                      type: 'workflow',
                      workflowId: workflow.id,
                      workflowData: {
                        id: workflow.id,
                        name: config.name,
                        description: workflowData.description,
                        goal: config.goal,
                        target_criteria: config.target_criteria,
                        tone: config.tone,
                        instructions: config.custom_prompt || '',
                        schedule: workflowData.schedule,
                        steps: workflowData.steps
                      }
                    }
                  };
                }
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
  // Map tone values: "professional" -> "formal" (database enum only accepts 'formal', 'casual', 'witty')
  const toneMap: Record<string, 'formal' | 'casual' | 'witty'> = {
    'professional': 'formal',
    'formal': 'formal',
    'casual': 'casual',
    'witty': 'witty'
  };
  const mappedTone = toneMap[workflowData.tone?.toLowerCase()] || 'casual';

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      user_id: user.id,
      name: workflowData.name,
      target_criteria: workflowData.target_criteria,
      tone: mappedTone,
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
              // Ensure we have a conversation ID - create one if needed
              let convId = currentConvId;
              if (!convId) {
                console.log('No conversation ID found, creating new conversation...');
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Not authenticated');
                
                // Get the first user message to use as title, or use default
                const firstUserMessage = messages.find(m => m.role === 'user')?.content;
                // Ensure we have a valid string for the title
                const titleMessage = (firstUserMessage && typeof firstUserMessage === 'string' && firstUserMessage.trim()) 
                  ? firstUserMessage.trim() 
                  : 'New Campaign Test Run';
                const newConvId = await createConversation(titleMessage);
                if (newConvId) {
                  convId = newConvId;
                  setCurrentConvId(convId);
                  console.log('Created new conversation:', convId);
                } else {
                  throw new Error('Failed to create conversation');
                }
              }
              
              // Check if there's already a running execution in this conversation
              // Only skip if execution is actually still running (not completed/failed)
              const existingExecution = messages.find(m => 
                m && m.metadata?.type === 'execution' && 
                m.metadata?.executionId
              );
              
              if (existingExecution) {
                // Check execution status in DB to see if it's still running
                try {
                  const { data: exec } = await supabase
                    .from('workflow_executions')
                    .select('status')
                    .eq('id', existingExecution.metadata?.executionId)
                    .single();
                  
                  // Only skip if execution is still running
                  if (exec && (exec.status === 'running' || exec.status === 'pending')) {
                    console.log('Execution already running in conversation, skipping duplicate');
                    finalAssistantContent = 'A test run is already in progress. Please wait for it to complete.';
                    return;
                  }
                } catch (e) {
                  // If we can't check status, proceed anyway (execution might have been deleted)
                  console.log('Could not check execution status, proceeding with new execution');
                }
              }
              
              const params = JSON.parse(toolCall.function.arguments);
              let { workflow_id, max_prospects = 5, skip_sending = true, enrich_emails = false, send_drafts_to_email } = params;
              
              // Clamp max_prospects between 1 and 25
              max_prospects = Math.max(1, Math.min(25, max_prospects));
              
              // Log what parameters we received
              console.log('Test run parameters:', {
                workflow_id,
                max_prospects,
                skip_sending,
                enrich_emails,
                send_drafts_to_email
              });
              
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');
              
              // For test runs, ALWAYS default to sending drafts to hariraghavan2023@gmail.com
              // This ensures drafts are always sent for review, regardless of skip_sending flag
              // skip_sending only affects sending to prospects, not the summary email
              if (!send_drafts_to_email || send_drafts_to_email === null || send_drafts_to_email === undefined || send_drafts_to_email === '') {
                send_drafts_to_email = 'hariraghavan2023@gmail.com';
                console.log(`No send_drafts_to_email specified, defaulting to: ${send_drafts_to_email}`);
              }
              
              console.log(`Final send_drafts_to_email value: "${send_drafts_to_email}"`);

              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              
              // If workflow_id is missing or not a UUID, try to find it from conversation
              if (!workflow_id || !uuidRegex.test(workflow_id)) {
                console.log('Workflow ID missing or invalid, attempting to find from conversation...');
                
                // First, try to find workflow from conversation_id
                if (convId) {
                  const { data: workflowFromConv, error: convWorkflowError } = await supabase
                    .from('workflows')
                    .select('id, name')
                    .eq('conversation_id', convId)
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  if (!convWorkflowError && workflowFromConv) {
                    workflow_id = workflowFromConv.id;
                    console.log(`Found workflow from conversation: ${workflowFromConv.name} (${workflow_id})`);
                  }
                }
                
                // If still not found, try to find by name (if workflow_id was provided as a name)
                if ((!workflow_id || !uuidRegex.test(workflow_id)) && params.workflow_id) {
                  console.log('Workflow ID is not a UUID, attempting lookup by name:', params.workflow_id);
                  const { data: foundWorkflow, error: lookupError } = await supabase
                    .from('workflows')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('name', params.workflow_id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (!lookupError && foundWorkflow) {
                    workflow_id = foundWorkflow.id;
                    console.log('Found workflow ID by name:', workflow_id);
                  }
                }
                
                // If still not found, try to find the most recent workflow for this user
                if (!workflow_id || !uuidRegex.test(workflow_id)) {
                  console.log('Attempting to find most recent workflow for user...');
                  const { data: recentWorkflow, error: recentError } = await supabase
                    .from('workflows')
                    .select('id, name')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  if (!recentError && recentWorkflow) {
                    workflow_id = recentWorkflow.id;
                    console.log(`Using most recent workflow: ${recentWorkflow.name} (${workflow_id})`);
                  }
                }
                
                // If still no workflow found, auto-create one
                if (!workflow_id || !uuidRegex.test(workflow_id)) {
                  console.log('No workflow found, auto-creating default workflow...');
                  
                  // Get conversation title for workflow name
                  let workflowName = 'Test Workflow';
                  if (convId) {
                    const { data: conversation } = await supabase
                      .from('campaign_conversations')
                      .select('title')
                      .eq('id', convId)
                      .single();
                    
                    if (conversation?.title) {
                      workflowName = conversation.title.substring(0, 50);
                    }
                  }

                  // Create default workflow with better default criteria
                  const { data: newWorkflow, error: createError } = await supabase
                    .from('workflows')
                    .insert({
                      user_id: user.id,
                      conversation_id: convId || null,
                      name: workflowName,
                      description: 'Auto-created workflow for test run',
                      workflow_config: {
                        target_criteria: { 
                          job_titles: ['Software Engineer', 'Product Manager', 'Marketing Manager', 'Sales Manager', 'Data Scientist']
                        },
                        tone: 'casual',
                        goal: 'meeting'
                      },
                      instructions: 'Generate personalized cold emails',
                      schedule_config: { frequency: 'daily', time: '09:00', batch_size: 25 },
                      status: 'draft'
                    })
                    .select()
                    .single();

                  if (createError || !newWorkflow) {
                    console.error('Failed to auto-create workflow:', createError);
                    // Don't throw - let backend handle it
                    workflow_id = undefined;
                  } else {
                    workflow_id = newWorkflow.id;
                    console.log('✅ Auto-created workflow:', workflow_id);
                  }
                }
              }

              // Try to find the campaign_id for this workflow by looking at the conversation
              let campaign_id: string | undefined = undefined;
              
              if (convId) {
                const { data: conversation, error: convError } = await supabase
                  .from('campaign_conversations')
                  .select('campaign_id')
                  .eq('id', convId)
                  .single();

                if (!convError && conversation?.campaign_id) {
                  campaign_id = conversation.campaign_id;
                  console.log(`Found campaign_id from conversation: ${campaign_id}`);
                } else if (workflow_id && uuidRegex.test(workflow_id)) {
                  // Try to find campaign from workflow
                  const { data: workflow } = await supabase
                    .from('workflows')
                    .select('conversation_id')
                    .eq('id', workflow_id)
                    .single();
                  
                  if (workflow?.conversation_id) {
                    const { data: conv, error: convError2 } = await supabase
                      .from('campaign_conversations')
                      .select('campaign_id')
                      .eq('id', workflow.conversation_id)
                      .single();
                    
                    if (!convError2 && conv?.campaign_id) {
                      campaign_id = conv.campaign_id;
                      console.log(`Found campaign_id from workflow's conversation: ${campaign_id}`);
                    }
                  }
                }
              }
              
              // campaign_id is optional - workflow can run without it
              console.log(`Running test with workflow_id: ${workflow_id || 'none (will be auto-detected)'}, campaign_id: ${campaign_id || 'none'}`);

              // Create workflow execution
              // Note: workflow_id can be undefined - backend will find it from conversation
              // Ensure user.id is valid UUID
              if (!user.id || !uuidRegex.test(user.id)) {
                throw new Error('Invalid user ID');
              }
              
              const executionData: any = {
                user_id: user.id,
                execution_type: 'manual',
                status: 'running',
                prospects_found: 0,
                emails_generated: 0,
                emails_sent: 0,
              };
              
              // Only include workflow_id if we found a valid one (must be UUID)
              if (workflow_id && uuidRegex.test(workflow_id)) {
                executionData.workflow_id = workflow_id;
              }
              
              // Only include campaign_id if we found it (must be UUID)
              if (campaign_id && uuidRegex.test(campaign_id)) {
                executionData.campaign_id = campaign_id;
              }
              
              // Note: conversation_id is passed to the edge function in the invoke body,
              // but not stored in workflow_executions table (it doesn't have that column)
              
              console.log('Inserting execution with data:', JSON.stringify(executionData, null, 2));
              
              const { data: execution, error: execError } = await supabase
                .from('workflow_executions')
                .insert(executionData)
                .select()
                .single();

              if (execError) {
                console.error('Error creating execution:', execError);
                console.error('Execution data:', JSON.stringify(executionData, null, 2));
                console.error('Full error details:', JSON.stringify(execError, null, 2));
                throw new Error(`Failed to create execution: ${execError.message || execError.details || JSON.stringify(execError)}`);
              }
              
              console.log('✅ Execution created successfully:', execution.id);

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

              // Trigger execution with campaign_id, max_prospects, skip_sending, enrich_emails, and send_drafts_to_email
              const invokeBody = { 
                workflow_id, 
                campaign_id,
                execution_id: execution.id,
                conversation_id: convId, // Pass conversation_id so backend can find workflow
                max_prospects,
                skip_sending,
                enrich_emails
              };
              
              // ALWAYS include send_drafts_to_email (we default it above if not set)
              // This ensures the summary email is always sent, even if skip_sending=true
              invokeBody.send_drafts_to_email = send_drafts_to_email;
              
              console.log('Invoking execute-workflow with:', invokeBody);
              console.log(`✅ send_drafts_to_email is set to: "${invokeBody.send_drafts_to_email}"`);
              
              // Invoke execute-workflow with proper error handling
              try {
                const { data, error: invokeError } = await supabase.functions.invoke('execute-workflow', {
                  body: invokeBody
                });

                if (invokeError) {
                  console.error('Error executing workflow:', invokeError);
                  
                  // Check if it's a deployment error
                  const isDeploymentError = invokeError.message?.includes('404') || 
                                           invokeError.message?.includes('not found') ||
                                           invokeError.message?.includes('FunctionsRelayError');
                  
                  throw new Error(isDeploymentError
                    ? "The execute-workflow function hasn't been deployed to Supabase. Please deploy it using: supabase functions deploy execute-workflow"
                    : invokeError.message || 'Failed to start workflow execution');
                }

                console.log('✅ Workflow execution started successfully:', data);
                
                finalAssistantContent = `Test run started for ${max_prospects} prospect${max_prospects === 1 ? '' : 's'}. See live progress below.`;
              } catch (invokeErr: any) {
                console.error('Error invoking execute-workflow:', invokeErr);
                throw new Error(invokeErr.message || 'Failed to invoke execute-workflow function');
              }
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
          } else if (toolCall.function?.name === 'set_sender_name') {
            try {
              const { name } = JSON.parse(toolCall.function.arguments);
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              // Use upsert (same pattern as Settings.tsx) - don't set updated_at manually, trigger handles it
              const { error: updateError } = await supabase
                .from('user_settings')
                .upsert({
                  user_id: user.id,
                  sender_name: name
                }, {
                  onConflict: 'user_id'
                });

              if (updateError) {
                console.error('Error saving sender name:', updateError);
                throw updateError;
              }

              toast({
                title: "✅ Name saved",
                description: `Your emails will be signed with "${name}"`,
              });

              finalAssistantContent = `Got it! I've saved "${name}" as your email signature name. Your emails will be signed with this name.`;
            } catch (error: any) {
              console.error('Error saving sender name:', error);
              const errorMessage = error?.message || error?.details || error?.hint || 'Unknown error occurred';
              toast({
                title: "Error saving name",
                description: errorMessage,
                variant: "destructive",
              });
              finalAssistantContent = `Sorry, I encountered an error saving your name: ${errorMessage}`;
            }
          } else if (toolCall.function?.name === 'set_email_template') {
            try {
              const templateData = JSON.parse(toolCall.function.arguments);
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              let workflowId = templateData.workflow_id;

              // Find workflow from conversation if not provided
              if (!workflowId && convId) {
                const { data: workflow } = await supabase
                  .from('workflows')
                  .select('id')
                  .eq('conversation_id', convId)
                  .eq('user_id', user.id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (workflow) {
                  workflowId = workflow.id;
                }
              }

              // If still no workflow found, try to find most recent workflow
              if (!workflowId) {
                const { data: recentWorkflow } = await supabase
                  .from('workflows')
                  .select('id')
                  .eq('user_id', user.id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (recentWorkflow) {
                  workflowId = recentWorkflow.id;
                }
              }

              // Auto-create workflow if none exists
              if (!workflowId) {
                console.log('No workflow found, auto-creating default workflow...');
                
                // Get conversation title for workflow name
                let workflowName = 'Email Campaign';
                if (convId) {
                  const { data: conversation } = await supabase
                    .from('campaign_conversations')
                    .select('title')
                    .eq('id', convId)
                    .single();
                  
                  if (conversation?.title) {
                    workflowName = conversation.title.substring(0, 50);
                  }
                }

                // Create default workflow with better default criteria
                const { data: newWorkflow, error: createError } = await supabase
                  .from('workflows')
                  .insert({
                    user_id: user.id,
                    conversation_id: convId || null,
                    name: workflowName,
                    description: 'Auto-created workflow for email template',
                    workflow_config: {
                      target_criteria: { 
                        job_titles: ['Software Engineer', 'Product Manager', 'Marketing Manager', 'Sales Manager', 'Data Scientist']
                      },
                      tone: 'casual',
                      goal: 'meeting'
                    },
                    instructions: 'Generate personalized cold emails',
                    schedule_config: { frequency: 'daily', time: '09:00', batch_size: 25 },
                    status: 'draft'
                  })
                  .select()
                  .single();

                if (createError || !newWorkflow) {
                  throw new Error(`Failed to create workflow: ${createError?.message || 'Unknown error'}`);
                }

                workflowId = newWorkflow.id;
                console.log('✅ Auto-created workflow:', workflowId);
              }

              // Get current workflow config
              const { data: currentWorkflow, error: fetchError } = await supabase
                .from('workflows')
                .select('workflow_config')
                .eq('id', workflowId)
                .eq('user_id', user.id)
                .single();

              if (fetchError) throw fetchError;

              // Update workflow_config with email_template
              const updatedConfig = {
                ...(currentWorkflow?.workflow_config || {}),
                email_template: {
                  type: templateData.template_type,
                  template_structure: templateData.template_structure || null,
                  example_email: templateData.example_email || null,
                  instructions: templateData.template_instructions || null,
                  set_at: new Date().toISOString()
                }
              };

              // Update workflow
              const { error: updateError } = await supabase
                .from('workflows')
                .update({
                  workflow_config: updatedConfig,
                  updated_at: new Date().toISOString()
                })
                .eq('id', workflowId)
                .eq('user_id', user.id);

              if (updateError) throw updateError;

              const templateDescription = templateData.template_type === 'example' 
                ? 'example email template'
                : 'structured template';

              toast({
                title: "✅ Email template saved",
                description: `Custom ${templateDescription} has been set for this workflow. All emails will follow this template.`,
              });

              finalAssistantContent = `Perfect! I've saved your custom ${templateDescription}. All emails generated for this workflow will follow this template. You can run a test to see it in action.`;
            } catch (error: any) {
              console.error('Error setting email template:', error);
              const errorMessage = error?.message || error?.details || error?.hint || 'Unknown error occurred';
              toast({
                title: "Error setting template",
                description: errorMessage,
                variant: "destructive",
              });
              finalAssistantContent = `Sorry, I encountered an error setting the template: ${errorMessage}`;
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

    // Update the assistant message with final content and persist
    if (convId) {
      const contentToSave = finalAssistantContent || streamedContent || 'I can help you create a campaign.';
      
      // Get the latest metadata from the current message state (may have been updated by tool calls)
      const currentMessage = messages[assistantMessageIndex];
      const metadataToSave = currentMessage?.metadata || messages[assistantMessageIndex]?.metadata;
      
      // Update the UI message with final content (preserve metadata)
      setMessages(prev => {
        const updated = [...prev];
        if (updated[assistantMessageIndex]) {
          updated[assistantMessageIndex] = {
            ...updated[assistantMessageIndex],
            content: contentToSave,
            // Preserve metadata if it exists
            ...(metadataToSave && { metadata: metadataToSave })
          };
        }
        return updated;
      });
      
      // Save to DB with metadata - but don't update local state (real-time subscription will handle it)
      const { error } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: convId,
          role: 'assistant',
          content: contentToSave,
          metadata: metadataToSave || null
        });
      
      if (error) {
        console.error('Error saving assistant message:', error);
      } else {
        console.log('✅ Saved assistant message with metadata:', metadataToSave ? 'yes' : 'no');
      }
    }

    } catch (error: any) {
      console.error('Error in chat:', error);
      
      // Extract error message - handle both string errors and JSON error responses
      let errorMessage = error.message || 'Sorry, I encountered an error. Please try again.';
      
      // If error is a JSON string, try to parse it
      try {
        const errorObj = typeof error.message === 'string' ? JSON.parse(error.message) : error.message;
        if (errorObj?.error) {
          errorMessage = errorObj.error;
        } else if (errorObj?.message) {
          errorMessage = errorObj.message;
        }
      } catch (e) {
        // Keep original message if parsing fails
      }
      
      // Check if it's a retryable error (503, 500, etc.)
      const isRetryable = errorMessage.includes('temporarily unavailable') || 
                         errorMessage.includes('service is currently unavailable') ||
                         errorMessage.includes('try again');
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage + (isRetryable ? '\n\n💡 This is usually temporary - please try again in a few moments.' : '')
      }]);
      
      toast({
        title: isRetryable ? "Service Temporarily Unavailable" : "Error",
        description: errorMessage + (isRetryable ? " Please try again in a few moments." : ""),
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
          {messages
            .filter(msg => msg && msg.role)
            // Filter out duplicate execution monitors - only show the most recent one per conversation
            .filter((message, index, arr) => {
              if (message.metadata?.type === 'execution') {
                // Find all execution messages
                const executionMessages = arr.filter(m => m && m.metadata?.type === 'execution');
                // Only keep the last one (most recent)
                const lastExecution = executionMessages[executionMessages.length - 1];
                return message === lastExecution;
              }
              return true;
            })
            .map((message, index) => (
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

                        // Check if there's already a running execution in this conversation
                        const existingExecution = messages.find(m => 
                          m && m.metadata?.type === 'execution' && 
                          m.metadata?.executionId
                        );
                        
                        if (existingExecution) {
                          console.log('Execution already exists in conversation, skipping duplicate');
                          toast({
                            title: "Test run already in progress",
                            description: "There's already a test run running in this conversation.",
                          });
                          return;
                        }

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

                        // Call execute-workflow edge function with proper error handling
                        try {
                          const { data: invokeData, error: invokeError } = await supabase.functions.invoke('execute-workflow', {
                            body: {
                              workflow_id: workflowId,
                              execution_id: execution.id,
                              conversation_id: currentConvId,
                              max_prospects: 5,
                              skip_sending: true,
                              send_drafts_to_email: 'hariraghavan2023@gmail.com',
                            },
                          });

                          if (invokeError) {
                            console.error('Error executing workflow:', invokeError);

                            // Check for Gmail connection error
                            const isGmailError = invokeError.message?.includes('GMAIL_NOT_CONNECTED');

                            // Check if error is due to function not being deployed
                            const isDeploymentError = invokeError.message?.includes('404') ||
                                                     invokeError.message?.includes('not found') ||
                                                     invokeError.message?.includes('FunctionsRelayError');

                            if (isGmailError) {
                              toast({
                                title: "Gmail Not Connected",
                                description: "Please connect your Gmail account in the chat to send emails.",
                                variant: "destructive",
                              });
                            } else {
                              toast({
                                title: isDeploymentError ? "Edge Function Not Deployed" : "Execution Error",
                                description: isDeploymentError
                                  ? "The execute-workflow function hasn't been deployed to Supabase. Please deploy it using: supabase functions deploy execute-workflow"
                                  : invokeError.message,
                                variant: "destructive",
                              });
                            }
                          } else {
                            console.log('✅ Workflow execution started successfully:', invokeData);
                          }
                        } catch (invokeErr: any) {
                          console.error('Error invoking execute-workflow:', invokeErr);
                          toast({
                            title: "Execution Error",
                            description: invokeErr.message || 'Failed to invoke execute-workflow function',
                            variant: "destructive",
                          });
                        }

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
