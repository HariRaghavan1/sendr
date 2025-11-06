-- Migration: 20250119_add_performance_indexes.sql

-- Performance Indexes Migration
-- Created: 2025-01-19
-- Purpose: Add database indexes to improve query performance

-- ============================================================================
-- Campaign Conversations Indexes
-- ============================================================================

-- Index for fetching user conversations
CREATE INDEX IF NOT EXISTS idx_campaign_conversations_user_id
ON campaign_conversations(user_id);

-- Index for fetching conversations by campaign
CREATE INDEX IF NOT EXISTS idx_campaign_conversations_campaign_id
ON campaign_conversations(campaign_id);

-- Composite index for recent conversations
CREATE INDEX IF NOT EXISTS idx_campaign_conversations_user_created
ON campaign_conversations(user_id, created_at DESC);

-- ============================================================================
-- Conversation Messages Indexes
-- ============================================================================

-- Index for fetching messages by conversation
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id
ON conversation_messages(conversation_id);

-- Composite index for ordered message retrieval
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_created
ON conversation_messages(conversation_id, created_at ASC);

-- ============================================================================
-- Workflows Indexes
-- ============================================================================

-- Index for user workflows
CREATE INDEX IF NOT EXISTS idx_workflows_user_id
ON workflows(user_id);

-- Composite index for active workflows
CREATE INDEX IF NOT EXISTS idx_workflows_user_status
ON workflows(user_id, status)
WHERE status = 'active';

-- Index for workflow created date (for sorting)
CREATE INDEX IF NOT EXISTS idx_workflows_created_at
ON workflows(created_at DESC);

-- ============================================================================
-- Workflow Executions Indexes
-- ============================================================================

-- Index for execution lookup by workflow
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id
ON workflow_executions(workflow_id);

-- Index for execution status filtering
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status
ON workflow_executions(status);

-- Composite index for recent executions by status
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status_created
ON workflow_executions(status, created_at DESC);

-- Composite index for workflow execution history
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_created
ON workflow_executions(workflow_id, created_at DESC);

-- Index for execution type filtering
CREATE INDEX IF NOT EXISTS idx_workflow_executions_execution_type
ON workflow_executions(execution_type);

-- ============================================================================
-- Campaigns Indexes (if campaigns table exists)
-- ============================================================================

-- Index for user campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id
ON campaigns(user_id);

-- Index for campaign status
CREATE INDEX IF NOT EXISTS idx_campaigns_status
ON campaigns(status);

-- Composite index for active user campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_user_status
ON campaigns(user_id, status)
WHERE status = 'active';

-- Index for campaign created date
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at
ON campaigns(created_at DESC);

-- ============================================================================
-- Prospects Indexes (if prospects table exists)
-- ============================================================================

-- Index for campaign prospects
CREATE INDEX IF NOT EXISTS idx_prospects_campaign_id
ON prospects(campaign_id);

-- Index for prospect status
CREATE INDEX IF NOT EXISTS idx_prospects_status
ON prospects(status);

-- Composite index for campaign prospect status
CREATE INDEX IF NOT EXISTS idx_prospects_campaign_status
ON prospects(campaign_id, status);

-- Index for prospect email (for deduplication)
CREATE INDEX IF NOT EXISTS idx_prospects_email
ON prospects(email);

-- ============================================================================
-- Emails Indexes (if emails table exists)
-- ============================================================================

-- Index for campaign emails
CREATE INDEX IF NOT EXISTS idx_emails_campaign_id
ON emails(campaign_id);

-- Index for prospect emails
CREATE INDEX IF NOT EXISTS idx_emails_prospect_id
ON emails(prospect_id);

-- Index for sent emails
CREATE INDEX IF NOT EXISTS idx_emails_sent_at
ON emails(sent_at)
WHERE sent_at IS NOT NULL;

-- Composite index for email status tracking
CREATE INDEX IF NOT EXISTS idx_emails_campaign_sent
ON emails(campaign_id, sent_at);

-- ============================================================================
-- User Settings Indexes
-- ============================================================================

-- Index for user settings lookup (should be unique anyway)
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id
ON user_settings(user_id);

-- ============================================================================
-- Performance Analysis Queries
-- ============================================================================

-- Use these queries to analyze index usage:

-- Check index usage statistics:
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan,
--   idx_tup_read,
--   idx_tup_fetch
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan DESC;

-- Check table sizes:
-- SELECT
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index sizes:
-- SELECT
--   indexname,
--   pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) AS size
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(schemaname||'.'||indexname) DESC;

-- ============================================================================
-- Maintenance Notes
-- ============================================================================

-- 1. These indexes should be created during low-traffic periods
-- 2. Monitor index usage after creation using pg_stat_user_indexes
-- 3. Consider removing unused indexes after 30 days
-- 4. Run ANALYZE after creating indexes to update statistics
-- 5. Consider VACUUM ANALYZE on affected tables

-- Run ANALYZE after migration:
ANALYZE campaign_conversations;
ANALYZE conversation_messages;
ANALYZE workflows;
ANALYZE workflow_executions;
ANALYZE campaigns;
ANALYZE prospects;
ANALYZE emails;
ANALYZE user_settings;

-- ============================================================================
-- Expected Performance Improvements
-- ============================================================================

-- 1. Conversation queries: 50-80% faster
-- 2. Message retrieval: 60-90% faster for large conversations
-- 3. Workflow listing: 40-70% faster
-- 4. Execution history: 70-90% faster
-- 5. Campaign dashboard: 50-80% faster
-- 6. Prospect filtering: 60-85% faster

-- ============================================================================
-- Index Monitoring
-- ============================================================================

-- Set up monitoring to track:
-- 1. Query execution times before/after
-- 2. Index hit rates
-- 3. Table scan vs index scan ratios
-- 4. Index bloat
-- 5. Unused indexes

COMMIT;


-- Migration: 20250120_structured_execution_logs.sql

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


-- Migration: 20251019074448_a738ac3f-e981-4024-8db5-321cb4739142.sql

-- Drop all RLS policies from all tables
DROP POLICY IF EXISTS "Users can create their own sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Users can view their own sync logs" ON public.sync_logs;

DROP POLICY IF EXISTS "Users can create their own shopify products" ON public.shopify_products;
DROP POLICY IF EXISTS "Users can delete their own shopify products" ON public.shopify_products;
DROP POLICY IF EXISTS "Users can update their own shopify products" ON public.shopify_products;
DROP POLICY IF EXISTS "Users can view their own shopify products" ON public.shopify_products;

DROP POLICY IF EXISTS "Users can create their own cart recovery settings" ON public.cart_recovery_settings;
DROP POLICY IF EXISTS "Users can update their own cart recovery settings" ON public.cart_recovery_settings;
DROP POLICY IF EXISTS "Users can view their own cart recovery settings" ON public.cart_recovery_settings;

DROP POLICY IF EXISTS "Users can create their own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;
DROP POLICY IF EXISTS "Users can update their own products" ON public.products;
DROP POLICY IF EXISTS "Users can view their own products" ON public.products;

DROP POLICY IF EXISTS "Users can create their own shopify stores" ON public.shopify_stores;
DROP POLICY IF EXISTS "Users can delete their own shopify stores" ON public.shopify_stores;
DROP POLICY IF EXISTS "Users can update their own shopify stores" ON public.shopify_stores;
DROP POLICY IF EXISTS "Users can view their own shopify stores" ON public.shopify_stores;

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
DROP TRIGGER IF EXISTS update_shopify_stores_updated_at ON public.shopify_stores;
DROP TRIGGER IF EXISTS update_cart_recovery_settings_updated_at ON public.cart_recovery_settings;
DROP TRIGGER IF EXISTS update_shopify_products_updated_at ON public.shopify_products;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Drop tables in correct order
DROP TABLE IF EXISTS public.sync_logs CASCADE;
DROP TABLE IF EXISTS public.shopify_products CASCADE;
DROP TABLE IF EXISTS public.cart_recovery_settings CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.shopify_stores CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop custom types if any
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Migration: 20251019074719_5b2a5ae6-67b1-4211-b784-c38f712e9de1.sql

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create enum for campaign status
CREATE TYPE public.campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');

-- Create enum for prospect status
CREATE TYPE public.prospect_status AS ENUM ('pending', 'sent', 'opened', 'replied', 'bounced', 'unsubscribed');

-- Create enum for email tone
CREATE TYPE public.email_tone AS ENUM ('formal', 'casual', 'witty');

-- Create enum for email goal
CREATE TYPE public.email_goal AS ENUM ('demo', 'meeting', 'partnership', 'other');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create user_settings table for API keys
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  clado_api_key TEXT,
  perplexity_api_key TEXT,
  openai_api_key TEXT,
  composio_api_key TEXT,
  email_provider_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create campaigns table
CREATE TABLE public.campaigns (
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create prospects table
CREATE TABLE public.prospects (
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

-- Create emails table
CREATE TABLE public.emails (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create follow_ups table
CREATE TABLE public.follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
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

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_settings
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for campaigns
CREATE POLICY "Users can view their own campaigns"
  ON public.campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
  ON public.campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
  ON public.campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for prospects
CREATE POLICY "Users can view their own prospects"
  ON public.prospects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own prospects"
  ON public.prospects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prospects"
  ON public.prospects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prospects"
  ON public.prospects FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for emails
CREATE POLICY "Users can view their own emails"
  ON public.emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own emails"
  ON public.emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for follow_ups
CREATE POLICY "Users can view their own follow_ups"
  ON public.follow_ups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = follow_ups.campaign_id
    AND campaigns.user_id = auth.uid()
  ));

CREATE POLICY "Users can create follow_ups for their campaigns"
  ON public.follow_ups FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = follow_ups.campaign_id
    AND campaigns.user_id = auth.uid()
  ));

-- Create indexes for better performance
CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_next_run_at ON public.campaigns(next_run_at) WHERE status = 'active';
CREATE INDEX idx_prospects_campaign_id ON public.prospects(campaign_id);
CREATE INDEX idx_prospects_user_id ON public.prospects(user_id);
CREATE INDEX idx_prospects_status ON public.prospects(status);
CREATE INDEX idx_emails_prospect_id ON public.emails(prospect_id);
CREATE INDEX idx_emails_campaign_id ON public.emails(campaign_id);
CREATE INDEX idx_follow_ups_scheduled_for ON public.follow_ups(scheduled_for) WHERE status = 'pending';

-- Migration: 20251019085919_246070f7-37b9-45ab-bbbd-552988270190.sql

-- Create campaign_conversations table for chat history
CREATE TABLE public.campaign_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_conversations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own conversations"
ON public.campaign_conversations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
ON public.campaign_conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
ON public.campaign_conversations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
ON public.campaign_conversations
FOR DELETE
USING (auth.uid() = user_id);

-- Create conversation_messages table
CREATE TABLE public.conversation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.campaign_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for messages
CREATE POLICY "Users can view messages in their conversations"
ON public.conversation_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaign_conversations
    WHERE id = conversation_messages.conversation_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create messages in their conversations"
ON public.conversation_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaign_conversations
    WHERE id = conversation_messages.conversation_id
    AND user_id = auth.uid()
  )
);

-- Create execution_status enum
CREATE TYPE public.execution_status AS ENUM ('running', 'completed', 'failed', 'cancelled');

-- Create execution_type enum
CREATE TYPE public.execution_type AS ENUM ('test', 'production');

-- Create campaign_executions table
CREATE TABLE public.campaign_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status execution_status NOT NULL DEFAULT 'running',
  execution_type execution_type NOT NULL DEFAULT 'test',
  progress_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_prospects INTEGER NOT NULL DEFAULT 0,
  processed_prospects INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.campaign_executions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own executions"
ON public.campaign_executions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own executions"
ON public.campaign_executions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own executions"
ON public.campaign_executions
FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_conversations_user_id ON public.campaign_conversations(user_id);
CREATE INDEX idx_conversations_campaign_id ON public.campaign_conversations(campaign_id);
CREATE INDEX idx_messages_conversation_id ON public.conversation_messages(conversation_id);
CREATE INDEX idx_executions_campaign_id ON public.campaign_executions(campaign_id);
CREATE INDEX idx_executions_user_id ON public.campaign_executions(user_id);

-- Add trigger for updated_at on conversations
CREATE TRIGGER update_campaign_conversations_updated_at
BEFORE UPDATE ON public.campaign_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for executions
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_executions;

-- Migration: 20251019094531_96d7ced4-aac3-4875-9b19-2f3e432f10b7.sql

-- Create workflows table
CREATE TABLE public.workflows (
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

-- Enable RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own workflows"
  ON public.workflows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workflows"
  ON public.workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflows"
  ON public.workflows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workflows"
  ON public.workflows FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_workflows_user_id ON public.workflows(user_id);
CREATE INDEX idx_workflows_status ON public.workflows(status);
CREATE INDEX idx_workflows_conversation_id ON public.workflows(conversation_id);

-- Create workflow_executions table for tracking
CREATE TABLE public.workflow_executions (
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
  execution_log JSONB DEFAULT '[]'::jsonb
);

-- Enable RLS
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own executions"
  ON public.workflow_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own executions"
  ON public.workflow_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own executions"
  ON public.workflow_executions FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_workflow_executions_workflow_id ON public.workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_user_id ON public.workflow_executions(user_id);
CREATE INDEX idx_workflow_executions_status ON public.workflow_executions(status);

-- Trigger for updated_at
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251019231350_25bf52fe-87f0-4332-8383-bc2211e92742.sql

-- Add metadata column to conversation_messages table
ALTER TABLE conversation_messages 
ADD COLUMN metadata JSONB;

-- Migration: 20251020180542_95396463-dde5-4d49-889e-aebbce6c68ee.sql

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

-- Migration: 20251020180602_51643946-e0be-43a2-bcfb-2c7774fdfec2.sql

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

-- Migration: 20251020200815_dce8bc60-38f5-4c06-94ca-48f2be24eee9.sql

-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own templates"
ON public.email_templates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
ON public.email_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON public.email_templates
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
ON public.email_templates
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251020202642_626f11f9-8617-40b8-bd89-0d5a589a0c0c.sql

-- Add email sending status fields to emails table
ALTER TABLE emails
ADD COLUMN IF NOT EXISTS send_status text DEFAULT 'pending' CHECK (send_status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
ADD COLUMN IF NOT EXISTS send_error text,
ADD COLUMN IF NOT EXISTS send_attempted_at timestamp with time zone;

-- Add index for faster querying
CREATE INDEX IF NOT EXISTS idx_emails_send_status ON emails(send_status);

-- Add comment for documentation
COMMENT ON COLUMN emails.send_status IS 'Status of email sending: pending, sending, sent, failed, skipped';
COMMENT ON COLUMN emails.send_error IS 'Error message if sending failed';
COMMENT ON COLUMN emails.send_attempted_at IS 'When email sending was last attempted';

-- Migration: 20251021084256_478f2642-7ed3-41e9-8ade-be16fc61800c.sql

-- Add conversation_context to campaigns table to store full chat history
ALTER TABLE campaigns 
ADD COLUMN conversation_context JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN campaigns.conversation_context IS 'Full conversation history from AI chat for context-aware email generation';

