import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { ExecutionMonitor } from './ExecutionMonitor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface TestRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
}

export const TestRunDialog = ({ open, onOpenChange, campaignId }: TestRunDialogProps) => {
  const [maxProspects, setMaxProspects] = useState(5);
  const [skipSending, setSkipSending] = useState(false);
  const [enrichEmails, setEnrichEmails] = useState(true);
  const [useTemplate, setUseTemplate] = useState(true);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleStartTest = async () => {
    // Validate template if enabled
    if (useTemplate && (!emailSubject.trim() || !emailBody.trim())) {
      toast({
        title: 'Template Required',
        description: 'Please provide both subject and body for the email template',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('execute-campaign', {
        body: {
          campaign_id: campaignId,
          execution_type: 'test',
          max_prospects: maxProspects,
          skip_sending: skipSending,
          enrich_emails: enrichEmails,
          email_template: useTemplate ? {
            subject: emailSubject,
            body: emailBody,
          } : null,
        },
      });

      if (error) {
        // Check if error is due to function not being deployed
        const isDeploymentError = error.message?.includes('404') ||
                                 error.message?.includes('not found') ||
                                 error.message?.includes('FunctionsRelayError');

        throw new Error(isDeploymentError
          ? "The execute-campaign function hasn't been deployed to Supabase. Please deploy it using: supabase functions deploy execute-campaign"
          : error.message);
      }

      setExecutionId(data.execution_id);

      toast({
        title: 'Test run started',
        description: `Testing with ${maxProspects} prospects`,
      });
    } catch (error: any) {
      console.error('Error starting test:', error);
      const isDeploymentError = error.message?.includes('deployed') || error.message?.includes('FunctionsRelayError');

      toast({
        title: isDeploymentError ? 'Edge Function Not Deployed' : 'Error',
        description: error.message || 'Failed to start test run',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setExecutionId(null);
    setMaxProspects(5);
    setSkipSending(false);
    setEnrichEmails(true);
    setUseTemplate(true);
    setEmailSubject('');
    setEmailBody('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test Campaign</DialogTitle>
          <DialogDescription>
            Run a test with a limited number of prospects to verify your campaign setup
          </DialogDescription>
        </DialogHeader>

        {executionId ? (
          <ExecutionMonitor executionId={executionId} />
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="max-prospects">Number of Prospects</Label>
              <Input
                id="max-prospects"
                type="number"
                min={1}
                max={20}
                value={maxProspects}
                onChange={(e) => setMaxProspects(parseInt(e.target.value) || 5)}
              />
              <p className="text-xs text-muted-foreground">
                Maximum 20 prospects for test runs
              </p>
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-template"
                  checked={useTemplate}
                  onCheckedChange={(checked) => setUseTemplate(checked as boolean)}
                />
                <Label
                  htmlFor="use-template"
                  className="text-sm font-medium cursor-pointer"
                >
                  Use email template (same email for all prospects)
                </Label>
              </div>

              {useTemplate && (
                <div className="space-y-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="email-subject">Email Subject</Label>
                    <Input
                      id="email-subject"
                      placeholder="Enter email subject..."
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-body">Email Body</Label>
                    <textarea
                      id="email-body"
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Enter email body... Use {name} for personalization."
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tip: Use {'{name}'}, {'{company}'}, {'{title}'} for basic personalization
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enrich-emails"
                  checked={enrichEmails}
                  onCheckedChange={(checked) => setEnrichEmails(checked as boolean)}
                />
                <Label
                  htmlFor="enrich-emails"
                  className="text-sm font-normal cursor-pointer"
                >
                  Enrich prospects with emails (4 credits per email)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skip-sending"
                  checked={skipSending}
                  onCheckedChange={(checked) => setSkipSending(checked as boolean)}
                />
                <Label
                  htmlFor="skip-sending"
                  className="text-sm font-normal cursor-pointer"
                >
                  Skip actual email sending (dry run)
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleStartTest} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Start Test
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
