import { useRealtimeExecution } from '@/hooks/useRealtimeExecution';
import { cn } from '@/lib/utils';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CheckCircle2, XCircle, Loader2, Search, Sparkles, Mail, TrendingUp, Users, Zap, Send, AlertCircle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ProspectGrid, type Prospect } from './ProspectCard';
import { EmailPreviewList, type EmailData } from './EmailPreviewCard';

interface ExecutionMonitorProps {
  executionId: string;
}

/**
 * ExecutionMonitor - Dynamic real-time execution tracking with rich UI
 *
 * Features:
 * - Live prospect cards appearing as they're found
 * - Email previews with quality scores
 * - Visual step timeline
 * - Performance metrics
 * - Activity logs
 * - Tab-based organization
 */
export const ExecutionMonitor = ({ executionId }: ExecutionMonitorProps) => {
  const { execution, loading } = useRealtimeExecution(executionId);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">No execution data available</p>
      </div>
    );
  }

  // Extract structured data from execution
  const prospects: Prospect[] = execution.prospects_data || [];
  const emails: EmailData[] = execution.emails_data || [];
  const performanceMetrics = execution.performance_metrics || {};

  // Calculate average email quality
  const avgQuality = emails.length > 0
    ? emails.reduce((sum, email) => sum + (email.quality_score || 0), 0) / emails.length
    : 0;

  // Calculate total execution time
  const totalTimeMs = performanceMetrics.total_duration_ms || 0;
  const totalTimeSec = Math.round(totalTimeMs / 1000);

  // Detect current step from latest log message
  const getCurrentStep = () => {
    if (!execution.progress_logs || execution.progress_logs.length === 0) return null;

    const latestLog = execution.progress_logs[execution.progress_logs.length - 1];
    const message = latestLog.message?.toLowerCase() || '';

    // Check in order of specificity (more specific checks first)
    if (message.includes('complete') || message.includes('finish')) {
      return { name: 'Completed', icon: CheckCircle2, color: 'text-success', status: 'completed' };
    } else if (message.includes('sending') || message.includes('sent')) {
      return { name: 'Sending Emails', icon: Mail, color: 'text-green-500', status: 'running' };
    } else if (message.includes('clado') || message.includes('searching') || message.includes('prospects')) {
      return { name: 'Finding Prospects', icon: Search, color: 'text-blue-500', status: 'running' };
    } else if (message.includes('openai') || message.includes('generating') || message.includes('email')) {
      return { name: 'Generating Emails', icon: Sparkles, color: 'text-purple-500', status: 'running' };
    }

    return { name: 'Initializing', icon: Loader2, color: 'text-muted-foreground', status: 'running' };
  };

  const currentStep = getCurrentStep();

  // Define workflow steps for visual timeline
  const workflowSteps = [
    { name: 'Initializing', icon: Loader2, color: 'text-gray-500' },
    { name: 'Finding Prospects', icon: Search, color: 'text-blue-500' },
    { name: 'Generating Emails', icon: Sparkles, color: 'text-purple-500' },
    { name: 'Completed', icon: CheckCircle2, color: 'text-green-500' },
  ];

  // Determine which step is active
  const activeStepIndex = currentStep
    ? workflowSteps.findIndex(step => step.name === currentStep.name)
    : 0;

  const progress = execution.total_prospects > 0
    ? (execution.processed_prospects / execution.total_prospects) * 100
    : 0;

  const getStatusIcon = () => {
    switch (execution.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      running: 'default',
      completed: 'secondary',
      failed: 'destructive',
      cancelled: 'secondary',
    };

    return (
      <Badge variant={variants[execution.status]}>
        {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-semibold text-foreground">
              {execution.execution_type === 'test' ? 'Test Run' : 'Production Run'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Started {formatDistanceToNow(new Date(execution.started_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Performance Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{prospects.length}</p>
                <p className="text-xs text-muted-foreground">Prospects Found</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Mail className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{emails.length}</p>
                <p className="text-xs text-muted-foreground">
                  Emails Generated
                  {emails.filter(e => e.send_status === 'sent').length > 0 && (
                    <span className="text-success ml-1">
                      ({emails.filter(e => e.send_status === 'sent').length} sent)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{Math.round(avgQuality)}</p>
                <p className="text-xs text-muted-foreground">Avg Quality Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Step Timeline */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            {workflowSteps.map((step, index) => {
              const isActive = index === activeStepIndex;
              const isCompleted = index < activeStepIndex || execution.status === 'completed';
              const StepIcon = step.icon;

              return (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all
                      ${isCompleted ? 'bg-success/20 border-2 border-success' :
                        isActive ? 'bg-primary/20 border-2 border-primary' :
                        'bg-muted border-2 border-border'}
                    `}
                  >
                    <StepIcon
                      className={`
                        h-5 w-5
                        ${isCompleted ? 'text-success' :
                          isActive ? 'text-primary' :
                          'text-muted-foreground'}
                        ${isActive && step.icon === Loader2 ? 'animate-spin' : ''}
                      `}
                    />
                  </div>
                  <p className={`
                    text-xs text-center
                    ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}
                  `}>
                    {step.name}
                  </p>
                  {index < workflowSteps.length - 1 && (
                    <div
                      className={`
                        absolute h-0.5 w-full top-5 left-1/2 -z-10
                        ${isCompleted ? 'bg-success' : 'bg-border'}
                      `}
                      style={{ width: 'calc(100% / 3)' }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">
                {execution.processed_prospects} / {execution.total_prospects}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(progress)}% complete</span>
              {totalTimeSec > 0 && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {totalTimeSec}s elapsed
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Content: Prospects, Emails, Logs */}
      <Tabs defaultValue="prospects" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="prospects" className="relative">
            Prospects
            {prospects.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {prospects.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="emails" className="relative">
            Emails
            {emails.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {emails.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="prospects" className="space-y-4 mt-4">
          <ProspectGrid
            prospects={prospects}
            loading={false}
            variant="default"
            emptyMessage={
              execution.status === 'running'
                ? 'Searching for prospects...'
                : 'No prospects found'
            }
          />
        </TabsContent>

        <TabsContent value="emails" className="space-y-4 mt-4">
          <EmailPreviewList
            emails={emails}
            loading={false}
            variant="default"
            defaultExpandFirst
            emptyMessage={
              execution.status === 'running' && prospects.length > 0
                ? 'Generating emails...'
                : 'No emails generated yet'
            }
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card className="border-border/50">
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 p-4">
                {execution.progress_logs && execution.progress_logs.length > 0 ? (
                  execution.progress_logs.map((log: any, index: number) => {
                    const logText = typeof log === 'string' ? log : (log.message || JSON.stringify(log));
                    const logType = logText.includes('Found:') || logText.includes('prospects found') ? 'prospect_found' :
                                  logText.includes('Email generated') || logText.includes('✨') ? 'email_generated' :
                                  logText.includes('Sending') || logText.includes('📤') ? 'email_sending' :
                                  logText.includes('✅') && logText.includes('sent') ? 'email_sent' :
                                  logText.includes('❌') || logText.includes('error') ? 'error' :
                                  logText.includes('🔍') || logText.includes('Searching') ? 'searching' : 'info';
                    
                    return (
                      <div
                        key={index}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg transition-all animate-fade-in",
                          logType === 'prospect_found' && "bg-blue-500/10 border border-blue-500/20",
                          logType === 'email_generated' && "bg-purple-500/10 border border-purple-500/20",
                          logType === 'email_sent' && "bg-green-500/10 border border-green-500/20",
                          logType === 'email_sending' && "bg-yellow-500/10 border border-yellow-500/20",
                          logType === 'error' && "bg-red-500/10 border border-red-500/20",
                          logType === 'searching' && "bg-cyan-500/10 border border-cyan-500/20",
                          logType === 'info' && "bg-muted/50 border border-border/50"
                        )}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {logType === 'prospect_found' && <Users className="h-4 w-4 text-blue-500" />}
                          {logType === 'email_generated' && <Sparkles className="h-4 w-4 text-purple-500" />}
                          {logType === 'email_sent' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          {logType === 'email_sending' && <Send className="h-4 w-4 text-yellow-500 animate-pulse" />}
                          {logType === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                          {logType === 'searching' && <Search className="h-4 w-4 text-cyan-500 animate-spin" />}
                          {logType === 'info' && <Info className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <p className="text-sm font-mono leading-relaxed break-words flex-1">
                          {logText}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin opacity-50" />
                      <p>Waiting for activity...</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
