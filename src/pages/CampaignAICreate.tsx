import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Send, Sparkles, Loader2 } from "lucide-react";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CampaignAICreate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm here to help you create an email outreach campaign. What kind of campaign would you like to create?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
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
      }

      // Handle tool calls (campaign creation)
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

            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Perfect! I've created your campaign "${config.name}". Redirecting you to view it...`
            }]);

            toast({
              title: "Campaign created!",
              description: `"${config.name}" has been created successfully.`,
            });

            setTimeout(() => navigate(`/campaigns/${campaign.id}`), 1500);
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
        content: 'Sorry, I encountered an error. Please try again or check that your OpenAI API key is configured in Settings.'
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
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">AI Campaign Creator</h1>
          </div>
        </div>

        <Card className="p-6 mb-4 min-h-[500px] max-h-[600px] overflow-y-auto">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </Card>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me about your campaign..."
            className="min-h-[60px]"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CampaignAICreate;
