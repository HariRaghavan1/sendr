-- Add metadata column to conversation_messages table
ALTER TABLE conversation_messages 
ADD COLUMN metadata JSONB;