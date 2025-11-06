-- Add sender_name column to user_settings for email signatures
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS sender_name TEXT;

COMMENT ON COLUMN user_settings.sender_name IS 'Name to use when signing emails (e.g., "Hari", "John", etc.)';

