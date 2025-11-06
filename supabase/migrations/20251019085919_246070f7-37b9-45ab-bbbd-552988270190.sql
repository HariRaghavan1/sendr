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