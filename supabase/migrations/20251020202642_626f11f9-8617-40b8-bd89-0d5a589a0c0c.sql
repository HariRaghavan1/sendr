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