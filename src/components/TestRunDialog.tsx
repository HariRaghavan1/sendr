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
  const [skipSending, setSkipSending] = useState(true);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleStartTest = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('execute-campaign', {
        body: {
          campaign_id: campaignId,
          execution_type: 'test',
          max_prospects: maxProspects,
          skip_sending: skipSending,
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
    setSkipSending(true);
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
