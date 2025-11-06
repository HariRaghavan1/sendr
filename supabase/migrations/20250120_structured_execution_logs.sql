-- Migration: Add structured execution logs
-- Created: 2025-01-20
-- Purpose: Enable rich, structured logging for workflow executions
--          to power dynamic UI updates (prospect cards, email previews)

-- Add new columns for structured data
ALTER TABLE public.workflow_executions
  ADD COLUMN IF NOT EXISTS prospects_data JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS emails_data JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS performance_metrics JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_prospects INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_prospects INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_status TEXT DEFAULT 'pending';

-- Add column comments for documentation
COMMENT ON COLUMN public.workflow_executions.prospects_data IS
  'Array of prospect objects found during execution: [{ id, name, title, company, linkedin_url, found_at }]';

COMMENT ON COLUMN public.workflow_executions.emails_data IS
  'Array of generated emails: [{ prospect_id, subject, body, generated_at, quality_score }]';

COMMENT ON COLUMN public.workflow_executions.performance_metrics IS
  'Performance tracking: { clado_search_ms, email_generation_ms, total_duration_ms, errors_count }';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_executions_user_date
  ON public.workflow_executions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_executions_workflow_date
  ON public.workflow_executions(workflow_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_executions_status
  ON public.workflow_executions(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_executions_type
  ON public.workflow_executions(execution_type, started_at DESC);

-- Add GIN index for JSONB queries (searching within prospect/email data)
CREATE INDEX IF NOT EXISTS idx_executions_prospects_data_gin
  ON public.workflow_executions USING GIN (prospects_data);

CREATE INDEX IF NOT EXISTS idx_executions_emails_data_gin
  ON public.workflow_executions USING GIN (emails_data);

-- Add constraints for data integrity
ALTER TABLE public.workflow_executions
  ADD CONSTRAINT check_valid_prospects_array
  CHECK (jsonb_typeof(prospects_data) = 'array'),

  ADD CONSTRAINT check_valid_emails_array
  CHECK (jsonb_typeof(emails_data) = 'array'),

  ADD CONSTRAINT check_valid_performance_metrics
  CHECK (jsonb_typeof(performance_metrics) = 'object'),

  ADD CONSTRAINT check_total_prospects_non_negative
  CHECK (total_prospects >= 0),

  ADD CONSTRAINT check_processed_prospects_non_negative
  CHECK (processed_prospects >= 0),

  ADD CONSTRAINT check_processed_lte_total
  CHECK (processed_prospects <= total_prospects);

-- Update existing rows to have valid default values
UPDATE public.workflow_executions
SET
  prospects_data = '[]'::jsonb,
  emails_data = '[]'::jsonb,
  performance_metrics = '{}'::jsonb,
  total_prospects = COALESCE(total_prospects, 0),
  processed_prospects = COALESCE(processed_prospects, 0)
WHERE prospects_data IS NULL
   OR emails_data IS NULL
   OR performance_metrics IS NULL;

-- Create helper function to add prospect to execution
CREATE OR REPLACE FUNCTION add_prospect_to_execution(
  p_execution_id UUID,
  p_prospect JSONB
) RETURNS void AS $$
BEGIN
  UPDATE public.workflow_executions
  SET
    prospects_data = prospects_data || p_prospect::jsonb,
    total_prospects = total_prospects + 1
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to add email to execution
CREATE OR REPLACE FUNCTION add_email_to_execution(
  p_execution_id UUID,
  p_email JSONB
) RETURNS void AS $$
BEGIN
  UPDATE public.workflow_executions
  SET
    emails_data = emails_data || p_email::jsonb,
    processed_prospects = processed_prospects + 1
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to update performance metrics
CREATE OR REPLACE FUNCTION update_execution_performance(
  p_execution_id UUID,
  p_metric_name TEXT,
  p_metric_value NUMERIC
) RETURNS void AS $$
BEGIN
  UPDATE public.workflow_executions
  SET performance_metrics = jsonb_set(
    performance_metrics,
    ARRAY[p_metric_name],
    to_jsonb(p_metric_value)
  )
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION add_prospect_to_execution(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION add_email_to_execution(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_execution_performance(UUID, TEXT, NUMERIC) TO authenticated;
