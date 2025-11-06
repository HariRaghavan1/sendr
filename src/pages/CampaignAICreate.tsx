import { useState } from "react";
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
      content: "Hi! I'll help you create a campaign. Just describe what you want in natural language.\n\nFor example:\n• \"Create a workflow that finds professors and sends them emails\"\n• \"Reach out to CTOs at tech startups in San Francisco\"\n• \"Find marketing directors at Fortune 500 companies\""
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Parse intent with AI
      const { data: parseData, error: parseError } = await supabase.functions.invoke('parse-campaign-intent', {
        body: { message: userMessage }
      });

      if (parseError) throw parseError;

      console.log('Parsed campaign config:', parseData);

      // Create campaign
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          user_id: user.id,
          name: parseData.name,
          target_criteria: parseData.target_criteria,
          tone: parseData.tone || 'casual',
          goal: parseData.goal || 'meeting',
          custom_prompt: parseData.custom_prompt,
          status: 'draft'
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Perfect! I've created your campaign "${parseData.name}".\n\nTarget: ${JSON.stringify(parseData.target_criteria, null, 2)}\nTone: ${parseData.tone || 'casual'}\nGoal: ${parseData.goal || 'meeting'}\n\nYou can now activate it from the dashboard!`
      }]);

      toast({
        title: "Campaign created!",
        description: `"${parseData.name}" is ready to use.`,
      });

      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (error: any) {
      console.error('Error creating campaign:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try rephrasing your request or use the manual form.`
      }]);
      toast({
        title: "Error",
        description: error.message,
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
          </div>
        </Card>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your campaign... (e.g., 'Find marketing directors at SaaS companies')"
            className="min-h-[60px]"
            disabled={loading}
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
