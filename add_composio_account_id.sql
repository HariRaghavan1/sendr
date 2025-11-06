-- Add composio_connected_account_id column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS composio_connected_account_id TEXT;

