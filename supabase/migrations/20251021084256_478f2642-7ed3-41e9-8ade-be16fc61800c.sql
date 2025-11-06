-- Add conversation_context to campaigns table to store full chat history
ALTER TABLE campaigns 
ADD COLUMN conversation_context JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN campaigns.conversation_context IS 'Full conversation history from AI chat for context-aware email generation';