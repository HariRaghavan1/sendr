import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useConversation } from "@/hooks/useConversation";
import { Send, Sparkles, Loader2, Play } from "lucide-react";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

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

      const response = await fetch(
        `https://tbbyxprlgrsrzvxvkpgz.supabase.co/functions/v1/campaign-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ messages: newMessages }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to get response');
      }

      const result = await response.json();
      const assistantText: string = result.content || '';
      const toolCalls: any[] = result.tool_calls || [];

      if (assistantText) {
        setMessages(prev => [...prev, { role: 'assistant', content: assistantText }]);
        if (convId) {
          await saveMessage(convId, 'assistant', assistantText);
        }
      }

      if (toolCalls.length > 0) {
        const toolCall = toolCalls.find(tc => tc.function?.name === 'create_campaign');
        if (toolCall?.function?.arguments) {
          try {
            const config = JSON.parse(toolCall.function.arguments);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

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

            // Link conversation to campaign
            if (convId) {
              await supabase
                .from('campaign_conversations')
                .update({ campaign_id: campaign.id })
                .eq('id', convId);
            }

            const successMsg = `Perfect! I've created your campaign "${config.name}". You can test it or view details.`;
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: successMsg
            }]);

            if (convId) {
              await saveMessage(convId, 'assistant', successMsg);
            }

            toast({
              title: "Campaign created!",
              description: `"${config.name}" has been created successfully.`,
            });

            setTimeout(() => navigate(`/campaigns/${campaign.id}`), 2000);
          } catch (error: any) {
            console.error('Error creating campaign:', error);
            toast({
              title: "Error creating campaign",
              description: error.message,
              variant: "destructive",
            });
          }
        }
      }

    } catch (error: any) {
      console.error('Error in chat:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
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
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
              </div>
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
