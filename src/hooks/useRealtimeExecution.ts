import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ProspectData {
  id: string;
  name: string;
  title?: string;
  company?: string;
  linkedin_url?: string;
  found_at?: string;
  index?: number;
}

interface EmailData {
  prospect_id: string;
  prospect_name: string;
  subject: string;
  body: string;
  generated_at?: string;
  index?: number;
  word_count?: number;
  quality_score?: number;
}

interface ExecutionData {
  id: string;
  campaign_id: string;
  user_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  execution_type: 'test' | 'production';
  progress_logs: any[];
  total_prospects: number;
  processed_prospects: number;
  started_at: string;
  completed_at: string | null;
  prospects_data?: ProspectData[];
  emails_data?: EmailData[];
  performance_metrics?: Record<string, number>;
}

/**
 * Custom hook for real-time tracking of campaign execution status
 *
 * Subscribes to Supabase real-time updates for both campaign_executions
 * and workflow_executions tables, providing live progress updates.
 *
 * @param executionId - Optional ID of the execution to track
 * @returns Object containing execution data and loading state
 *
 * @example
 * ```tsx
 * const { execution, loading } = useRealtimeExecution(executionId);
 * ```
 */
export const useRealtimeExecution = (executionId?: string) => {
  const [execution, setExecution] = useState<ExecutionData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!executionId) return;

    let channel: RealtimeChannel;

    const setupRealtime = async () => {
      setLoading(true);

      // Try campaign_executions first
      let { data } = await supabase
        .from('campaign_executions')
        .select('*')
        .eq('id', executionId)
        .maybeSingle();

      // If not found, try workflow_executions
      if (!data) {
        const { data: workflowData } = await supabase
          .from('workflow_executions')
          .select('*')
          .eq('id', executionId)
          .maybeSingle();
        
        if (workflowData) {
          // Map workflow_executions to ExecutionData format
          data = {
            id: workflowData.id,
            campaign_id: workflowData.campaign_id || '',
            user_id: workflowData.user_id,
            status: (workflowData.status || 'running') as 'running' | 'completed' | 'failed' | 'cancelled',
            execution_type: 'test' as const,
            progress_logs: workflowData.execution_log || [],
            total_prospects: workflowData.total_prospects || workflowData.prospects_found || 0,
            processed_prospects: workflowData.processed_prospects || workflowData.emails_generated || 0,
            started_at: workflowData.started_at,
            completed_at: workflowData.completed_at,
            prospects_data: workflowData.prospects_data || [],
            emails_data: workflowData.emails_data || [],
            performance_metrics: workflowData.performance_metrics || {},
          };
        }
      }

      if (data) {
        setExecution(data as ExecutionData);
      }
      setLoading(false);

      // Subscribe to changes on both tables
      channel = supabase
        .channel(`execution-${executionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'campaign_executions',
            filter: `id=eq.${executionId}`,
          },
          (payload) => {
            setExecution(payload.new as ExecutionData);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'workflow_executions',
            filter: `id=eq.${executionId}`,
          },
          (payload) => {
            const mapped: ExecutionData = {
              id: payload.new.id,
              campaign_id: payload.new.campaign_id || '',
              user_id: payload.new.user_id,
              status: (payload.new.status || 'running') as 'running' | 'completed' | 'failed' | 'cancelled',
              execution_type: 'test' as const,
              progress_logs: payload.new.execution_log || [],
              total_prospects: payload.new.total_prospects || payload.new.prospects_found || 0,
              processed_prospects: payload.new.processed_prospects || payload.new.emails_generated || 0,
              started_at: payload.new.started_at,
              completed_at: payload.new.completed_at,
              prospects_data: payload.new.prospects_data || [],
              emails_data: payload.new.emails_data || [],
              performance_metrics: payload.new.performance_metrics || {},
            };
            setExecution(mapped);
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [executionId]);

  return { execution, loading };
};
