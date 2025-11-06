import { useRealtimeExecution } from '@/hooks/useRealtimeExecution';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ExecutionMonitorProps {
  executionId: string;
}

export const ExecutionMonitor = ({ executionId }: ExecutionMonitorProps) => {
  const { execution, loading } = useRealtimeExecution(executionId);

  if (loading || !execution) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
    <div className="space-y-4">
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

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium text-foreground">
            {execution.processed_prospects} / {execution.total_prospects}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground text-right">
          {Math.round(progress)}% complete
        </p>
      </div>

      {/* Logs */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Activity Log</h4>
        <ScrollArea className="h-[300px] rounded-lg border border-border bg-card">
          <div className="p-4 space-y-2">
            {execution.progress_logs && execution.progress_logs.length > 0 ? (
              execution.progress_logs.map((log: any, index: number) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <Clock className="h-3 w-3 mt-1 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-foreground">{log.message}</p>
                    {log.timestamp && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No logs yet...</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
