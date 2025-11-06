-- Add new columns to workflow_executions for better real-time tracking
ALTER TABLE workflow_executions
ADD COLUMN IF NOT EXISTS prospects_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS emails_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS performance_metrics JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS total_prospects INTEGER DEFAULT 0;

-- Create function to add prospect to execution
CREATE OR REPLACE FUNCTION add_prospect_to_execution(
  p_execution_id UUID,
  p_prospect JSONB
)
RETURNS void AS $$
BEGIN
  UPDATE workflow_executions
  SET prospects_data = COALESCE(prospects_data, '[]'::jsonb) || jsonb_build_array(p_prospect)
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to add email to execution
CREATE OR REPLACE FUNCTION add_email_to_execution(
  p_execution_id UUID,
  p_email JSONB
)
RETURNS void AS $$
BEGIN
  UPDATE workflow_executions
  SET emails_data = COALESCE(emails_data, '[]'::jsonb) || jsonb_build_array(p_email)
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for workflow_executions
ALTER TABLE workflow_executions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE workflow_executions;