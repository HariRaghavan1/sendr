import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ExternalLink, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GmailConnectCardProps {
  reason: string;
}

export const GmailConnectCard = ({ reason }: GmailConnectCardProps) => {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('composio-auth');
      
      if (error) throw error;
      
      if (data.error) {
        toast({
          title: "Configuration Required",
          description: data.error,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Open Composio auth in new window
      const authWindow = window.open(data.redirect_url, '_blank', 'width=600,height=700');
      
      if (!authWindow) {
        toast({
          title: "Popup Blocked",
          description: "Please allow popups for this site to connect Gmail.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Poll for connection completion
      const pollInterval = setInterval(async () => {
        try {
          // Check if user has connected Gmail via Composio
          const { data: settings } = await supabase
            .from('user_settings')
            .select('composio_api_key')
            .single();
          
          if (settings?.composio_api_key) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              clearInterval(pollInterval);
              return;
            }

            const response = await fetch(
              `https://backend.composio.dev/api/v2/connected-accounts?entityId=${user.id}`,
              {
                headers: {
                  'X-API-Key': settings.composio_api_key,
                  'Content-Type': 'application/json',
                },
              }
            );
            
            if (response.ok) {
              const connections = await response.json();
              const gmailConnected = connections.some((c: any) => 
                c.appName?.toLowerCase() === 'gmail' || 
                c.integrationId?.toLowerCase().includes('gmail') ||
                c.appUniqueId?.toLowerCase().includes('gmail')
              );
              
              if (gmailConnected) {
                clearInterval(pollInterval);
                authWindow?.close();
                setConnected(true);
                setLoading(false);
                toast({
                  title: "✅ Gmail Connected!",
                  description: "You can now send emails through your Gmail account.",
                });
              }
            }
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setLoading(false);
      }, 300000);
      
    } catch (error: any) {
      console.error('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  if (connected) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="h-5 w-5" />
            Gmail Connected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-600 dark:text-green-400">
            Your Gmail account is ready to send emails!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Connect Gmail Account
        </CardTitle>
        <CardDescription>{reason}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          To send emails, you need to authorize this app to use your Gmail account through Composio. 
          This is a secure OAuth flow - we never see your password.
        </p>
        
        <Button
          onClick={handleConnect}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opening Authorization...
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 h-4 w-4" />
              Connect Gmail
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">What happens next:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>You'll be redirected to Google's secure login</li>
            <li>Grant permission to send emails on your behalf</li>
            <li>Return here to continue</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
