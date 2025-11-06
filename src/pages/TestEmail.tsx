import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function TestEmail() {
  const [recipientEmail, setRecipientEmail] = useState('hariraghavan2023@gmail.com');
  const [subject, setSubject] = useState('Test Email from Bork');
  const [body, setBody] = useState('This is a test email from the Bork email outreach platform. If you receive this, email sending is working correctly!');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSendTest = async () => {
    if (!recipientEmail) {
      toast({
        title: 'Error',
        description: 'Please enter a recipient email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            recipient_email: recipientEmail,
            subject: subject,
            body: body,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.details ? `${result.error || 'Failed to send email'}: ${result.details}` : (result.error || 'Failed to send email');
        throw new Error(errorMsg);
      }

      console.log('✅ Email sent successfully!');
      console.log('Full response:', result);
      
      toast({
        title: '✅ Email Sent!',
        description: `Test email sent successfully to ${recipientEmail}. Check your inbox!`,
      });
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send test email',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Test Email Sending</CardTitle>
          <CardDescription>
            Send a test email to verify your Gmail connection and Composio integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Email</Label>
            <Input
              id="recipient"
              type="email"
              placeholder="hariraghavan2023@gmail.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              type="text"
              placeholder="Test Email from Bork"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Email Body</Label>
            <Textarea
              id="body"
              placeholder="Enter email body..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
            />
          </div>

          <Button
            onClick={handleSendTest}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Sending...' : 'Send Test Email'}
          </Button>

          <div className="text-sm text-muted-foreground space-y-1 pt-2">
            <p>⚠️ Make sure:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Your Composio API key is set in Settings</li>
              <li>Gmail is connected (check Settings page)</li>
              <li>You're logged in to the app</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

