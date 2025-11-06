import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ExecutionData {
  id: string;
  campaign_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  execution_type: 'test' | 'production';
  progress_logs: any[];
  total_prospects: number;
  processed_prospects: number;
  started_at: string;
  completed_at: string | null;
}

export const useRealtimeExecution = (executionId?: string) => {
  const [execution, setExecution] = useState<ExecutionData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!executionId) return;

    let channel: RealtimeChannel;

    const setupRealtime = async () => {
      setLoading(true);

      // Load initial data
      const { data } = await supabase
        .from('campaign_executions')
        .select('*')
        .eq('id', executionId)
        .single();

      if (data) {
        setExecution(data as ExecutionData);
      }
      setLoading(false);

      // Subscribe to changes
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
