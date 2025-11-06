-- Fix security warnings by setting search_path on RPC functions
DROP FUNCTION IF EXISTS add_prospect_to_execution(UUID, JSONB);
DROP FUNCTION IF EXISTS add_email_to_execution(UUID, JSONB);

CREATE OR REPLACE FUNCTION add_prospect_to_execution(
  p_execution_id UUID,
  p_prospect JSONB
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workflow_executions
  SET prospects_data = COALESCE(prospects_data, '[]'::jsonb) || jsonb_build_array(p_prospect)
  WHERE id = p_execution_id;
END;
$$;

CREATE OR REPLACE FUNCTION add_email_to_execution(
  p_execution_id UUID,
  p_email JSONB
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workflow_executions
  SET emails_data = COALESCE(emails_data, '[]'::jsonb) || jsonb_build_array(p_email)
  WHERE id = p_execution_id;
END;
$$;