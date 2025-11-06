-- ============================================================================
-- COMPLETE SUPABASE SETUP MIGRATION
-- Project: Email Outreach Platform (Bork)
-- Run this entire file in your Supabase SQL Editor
-- ============================================================================

-- Step 1: Create enums (if not exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
    CREATE TYPE public.campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prospect_status') THEN
    CREATE TYPE public.prospect_status AS ENUM ('pending', 'sent', 'opened', 'replied', 'bounced', 'unsubscribed');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_tone') THEN
    CREATE TYPE public.email_tone AS ENUM ('formal', 'casual', 'witty');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_goal') THEN
    CREATE TYPE public.email_goal AS ENUM ('demo', 'meeting', 'partnership', 'call', 'information', 'other');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'execution_status') THEN
    CREATE TYPE public.execution_status AS ENUM ('running', 'completed', 'failed', 'cancelled');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'execution_type') THEN
    CREATE TYPE public.execution_type AS ENUM ('test', 'production', 'manual');
  END IF;
END $$;

-- Step 2: Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 3: Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Step 4: Create user_settings table for API keys
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  clado_api_key TEXT,
  perplexity_api_key TEXT,
  openai_api_key TEXT,
  composio_api_key TEXT,
  composio_connected_account_id TEXT,
  email_provider_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 5: Create campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status campaign_status NOT NULL DEFAULT 'draft',
  target_criteria JSONB NOT NULL DEFAULT '{}',
  tone email_tone NOT NULL DEFAULT 'casual',
  goal email_goal NOT NULL DEFAULT 'meeting',
  custom_prompt TEXT,
  frequency_config JSONB NOT NULL DEFAULT '{"type": "daily", "time": "09:00", "batch_size": 25}',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,
  total_replied INTEGER NOT NULL DEFAULT 0,
  total_bounced INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  conversation_context JSONB DEFAULT '[]'::jsonb
);

-- Step 6: Create prospects table
CREATE TABLE IF NOT EXISTS public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  title TEXT,
  company TEXT,
  linkedin_url TEXT,
  enrichment_data JSONB DEFAULT '{}',
  status prospect_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 7: Create emails table
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounce_reason TEXT,
  external_id TEXT,
  send_status text DEFAULT 'pending' CHECK (send_status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  send_error text,
  send_attempted_at timestamp with time zone,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 8: Create campaign_conversations table
CREATE TABLE IF NOT EXISTS public.campaign_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 9: Create conversation_messages table
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.campaign_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 10: Create campaign_executions table
CREATE TABLE IF NOT EXISTS public.campaign_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status execution_status NOT NULL DEFAULT 'running',
  execution_type execution_type NOT NULL DEFAULT 'test',
  progress_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_prospects INTEGER NOT NULL DEFAULT 0,
  processed_prospects INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Step 11: Create workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES campaign_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  workflow_config JSONB NOT NULL,
  instructions TEXT NOT NULL,
  schedule_config JSONB NOT NULL DEFAULT '{"frequency": "daily", "time": "09:00", "batch_size": 25}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 12: Create workflow_executions table
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  execution_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'running',
  prospects_found INTEGER DEFAULT 0,
  emails_generated INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  execution_log JSONB DEFAULT '[]'::jsonb,
  prospects_data JSONB DEFAULT '[]'::jsonb,
  emails_data JSONB DEFAULT '[]'::jsonb,
  performance_metrics JSONB DEFAULT '{}'::jsonb,
  total_prospects INTEGER DEFAULT 0,
  processed_prospects INTEGER DEFAULT 0,
  execution_status TEXT DEFAULT 'pending'
);

-- Step 13: Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 14: Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Step 15: Create helper functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name')
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Step 16: Create triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_prospects_updated_at ON public.prospects;
CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_conversations_updated_at ON public.campaign_conversations;
CREATE TRIGGER update_campaign_conversations_updated_at
  BEFORE UPDATE ON public.campaign_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflows_updated_at ON public.workflows;
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 17: Create RLS Policies
-- Profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User Roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- User Settings
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Campaigns
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
CREATE POLICY "Users can view their own campaigns"
  ON public.campaigns FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own campaigns" ON public.campaigns;
CREATE POLICY "Users can create their own campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
CREATE POLICY "Users can update their own campaigns"
  ON public.campaigns FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;
CREATE POLICY "Users can delete their own campaigns"
  ON public.campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Prospects
DROP POLICY IF EXISTS "Users can view their own prospects" ON public.prospects;
CREATE POLICY "Users can view their own prospects"
  ON public.prospects FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own prospects" ON public.prospects;
CREATE POLICY "Users can create their own prospects"
  ON public.prospects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own prospects" ON public.prospects;
CREATE POLICY "Users can update their own prospects"
  ON public.prospects FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own prospects" ON public.prospects;
CREATE POLICY "Users can delete their own prospects"
  ON public.prospects FOR DELETE
  USING (auth.uid() = user_id);

-- Emails
DROP POLICY IF EXISTS "Users can view their own emails" ON public.emails;
CREATE POLICY "Users can view their own emails"
  ON public.emails FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own emails" ON public.emails;
CREATE POLICY "Users can create their own emails"
  ON public.emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Campaign Conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.campaign_conversations;
CREATE POLICY "Users can view their own conversations"
  ON public.campaign_conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own conversations" ON public.campaign_conversations;
CREATE POLICY "Users can create their own conversations"
  ON public.campaign_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.campaign_conversations;
CREATE POLICY "Users can update their own conversations"
  ON public.campaign_conversations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.campaign_conversations;
CREATE POLICY "Users can delete their own conversations"
  ON public.campaign_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Conversation Messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.conversation_messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_conversations
      WHERE id = conversation_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.conversation_messages;
CREATE POLICY "Users can create messages in their conversations"
  ON public.conversation_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_conversations
      WHERE id = conversation_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Campaign Executions
DROP POLICY IF EXISTS "Users can view their own executions" ON public.campaign_executions;
CREATE POLICY "Users can view their own executions"
  ON public.campaign_executions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own executions" ON public.campaign_executions;
CREATE POLICY "Users can create their own executions"
  ON public.campaign_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own executions" ON public.campaign_executions;
CREATE POLICY "Users can update their own executions"
  ON public.campaign_executions FOR UPDATE
  USING (auth.uid() = user_id);

-- Workflows
DROP POLICY IF EXISTS "Users can view their own workflows" ON public.workflows;
CREATE POLICY "Users can view their own workflows"
  ON public.workflows FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own workflows" ON public.workflows;
CREATE POLICY "Users can create their own workflows"
  ON public.workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own workflows" ON public.workflows;
CREATE POLICY "Users can update their own workflows"
  ON public.workflows FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own workflows" ON public.workflows;
CREATE POLICY "Users can delete their own workflows"
  ON public.workflows FOR DELETE
  USING (auth.uid() = user_id);

-- Workflow Executions
DROP POLICY IF EXISTS "Users can view their own executions" ON public.workflow_executions;
CREATE POLICY "Users can view their own executions"
  ON public.workflow_executions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own executions" ON public.workflow_executions;
CREATE POLICY "Users can create their own executions"
  ON public.workflow_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own executions" ON public.workflow_executions;
CREATE POLICY "Users can update their own executions"
  ON public.workflow_executions FOR UPDATE
  USING (auth.uid() = user_id);

-- Email Templates
DROP POLICY IF EXISTS "Users can view their own templates" ON public.email_templates;
CREATE POLICY "Users can view their own templates"
  ON public.email_templates FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own templates" ON public.email_templates;
CREATE POLICY "Users can create their own templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own templates" ON public.email_templates;
CREATE POLICY "Users can update their own templates"
  ON public.email_templates FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.email_templates;
CREATE POLICY "Users can delete their own templates"
  ON public.email_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Step 18: Create helper functions for workflow executions
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
  SET prospects_data = COALESCE(prospects_data, '[]'::jsonb) || jsonb_build_array(p_prospect),
      total_prospects = total_prospects + 1
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
  SET emails_data = COALESCE(emails_data, '[]'::jsonb) || jsonb_build_array(p_email),
      processed_prospects = processed_prospects + 1
  WHERE id = p_execution_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_execution_performance(
  p_execution_id UUID,
  p_metric_name TEXT,
  p_metric_value NUMERIC
)
RETURNS void AS $$
BEGIN
  UPDATE workflow_executions
  SET performance_metrics = jsonb_set(
    COALESCE(performance_metrics, '{}'::jsonb),
    ARRAY[p_metric_name],
    to_jsonb(p_metric_value)
  )
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_prospect_to_execution(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION add_email_to_execution(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_execution_performance(UUID, TEXT, NUMERIC) TO authenticated;

-- Step 19: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_next_run_at ON public.campaigns(next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_status ON public.campaigns(user_id, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_prospects_campaign_id ON public.prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_prospects_user_id ON public.prospects(user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON public.prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_campaign_status ON public.prospects(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_prospects_email ON public.prospects(email);

CREATE INDEX IF NOT EXISTS idx_emails_prospect_id ON public.emails(prospect_id);
CREATE INDEX IF NOT EXISTS idx_emails_campaign_id ON public.emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_emails_send_status ON public.emails(send_status);
CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON public.emails(sent_at) WHERE sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_campaign_sent ON public.emails(campaign_id, sent_at);

CREATE INDEX IF NOT EXISTS idx_campaign_conversations_user_id ON public.campaign_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_conversations_campaign_id ON public.campaign_conversations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_conversations_user_created ON public.campaign_conversations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_created ON public.conversation_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_executions_campaign_id ON public.campaign_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_executions_user_id ON public.campaign_executions(user_id);

CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON public.workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_user_status ON public.workflows(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON public.workflows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_conversation_id ON public.workflows(conversation_id);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON public.workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status_created ON public.workflow_executions(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_created ON public.workflow_executions(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_execution_type ON public.workflow_executions(execution_type);
CREATE INDEX IF NOT EXISTS idx_executions_user_date ON public.workflow_executions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_workflow_date ON public.workflow_executions(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_type ON public.workflow_executions(execution_type, started_at DESC);

-- GIN indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_executions_prospects_data_gin ON public.workflow_executions USING GIN (prospects_data);
CREATE INDEX IF NOT EXISTS idx_executions_emails_data_gin ON public.workflow_executions USING GIN (emails_data);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Step 20: Enable realtime for executions
ALTER TABLE workflow_executions REPLICA IDENTITY FULL;
-- Add tables to realtime publication (idempotent - only add if not already present)
DO $$
BEGIN
  -- Add workflow_executions if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'workflow_executions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE workflow_executions;
  END IF;
  
  -- Add campaign_executions if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'campaign_executions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE campaign_executions;
  END IF;
END $$;

-- Step 21: Add constraints for data integrity
ALTER TABLE public.workflow_executions
  DROP CONSTRAINT IF EXISTS check_valid_prospects_array,
  DROP CONSTRAINT IF EXISTS check_valid_emails_array,
  DROP CONSTRAINT IF EXISTS check_valid_performance_metrics,
  DROP CONSTRAINT IF EXISTS check_total_prospects_non_negative,
  DROP CONSTRAINT IF EXISTS check_processed_prospects_non_negative,
  DROP CONSTRAINT IF EXISTS check_processed_lte_total;

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

-- Step 22: Update existing rows to have valid default values
UPDATE public.workflow_executions
SET
  prospects_data = COALESCE(prospects_data, '[]'::jsonb),
  emails_data = COALESCE(emails_data, '[]'::jsonb),
  performance_metrics = COALESCE(performance_metrics, '{}'::jsonb),
  total_prospects = COALESCE(total_prospects, 0),
  processed_prospects = COALESCE(processed_prospects, 0)
WHERE prospects_data IS NULL
   OR emails_data IS NULL
   OR performance_metrics IS NULL;

-- Step 23: Add column comments
COMMENT ON COLUMN public.workflow_executions.prospects_data IS
  'Array of prospect objects found during execution: [{ id, name, title, company, linkedin_url, found_at }]';

COMMENT ON COLUMN public.workflow_executions.emails_data IS
  'Array of generated emails: [{ prospect_id, subject, body, generated_at, quality_score }]';

COMMENT ON COLUMN public.workflow_executions.performance_metrics IS
  'Performance tracking: { clado_search_ms, email_generation_ms, total_duration_ms, errors_count }';

COMMENT ON COLUMN public.campaigns.conversation_context IS
  'Full conversation history from AI chat for context-aware email generation';

COMMENT ON COLUMN public.emails.send_status IS
  'Status of email sending: pending, sending, sent, failed, skipped';

COMMENT ON COLUMN public.emails.send_error IS
  'Error message if sending failed';

COMMENT ON COLUMN public.emails.send_attempted_at IS
  'When email sending was last attempted';

-- Step 24: Run ANALYZE to update statistics
ANALYZE campaign_conversations;
ANALYZE conversation_messages;
ANALYZE workflows;
ANALYZE workflow_executions;
ANALYZE campaigns;
ANALYZE prospects;
ANALYZE emails;
ANALYZE user_settings;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- Next steps:
-- 1. Set OpenAI API key as Supabase secret (see SETUP_COMPLETE.md)
-- 2. Test the app: npm run dev
-- ============================================================================
