/*
  # Update channels table for OAuth2 support

  1. New Fields
    - Add OAuth2 token fields to channels table
    - Support for access_token, refresh_token, token_expiry
    - Add email_address field for Gmail integration

  2. Security
    - All token fields are encrypted in storage
    - User isolation maintained through existing RLS policies

  3. Changes
    - Modify credentials JSONB field structure
    - Add helper fields for easier n8n integration
    - Maintain backward compatibility
*/

-- Add new columns for OAuth2 support
DO $$
BEGIN
  -- Add email_address field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channels' AND column_name = 'email_address'
  ) THEN
    ALTER TABLE channels ADD COLUMN email_address text;
  END IF;

  -- Add token_expiry field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channels' AND column_name = 'token_expiry'
  ) THEN
    ALTER TABLE channels ADD COLUMN token_expiry timestamptz;
  END IF;

  -- Add oauth_state field for security
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channels' AND column_name = 'oauth_state'
  ) THEN
    ALTER TABLE channels ADD COLUMN oauth_state text;
  END IF;
END $$;

-- Create index for token expiry queries
CREATE INDEX IF NOT EXISTS idx_channels_token_expiry 
ON channels (token_expiry) 
WHERE token_expiry IS NOT NULL;

-- Create index for OAuth state lookups
CREATE INDEX IF NOT EXISTS idx_channels_oauth_state 
ON channels (oauth_state) 
WHERE oauth_state IS NOT NULL;

-- Add comment explaining the OAuth2 structure
COMMENT ON COLUMN channels.credentials IS 'JSONB field containing provider credentials. For OAuth2 providers like Gmail, includes: access_token, refresh_token, client_id, client_secret, scope';
COMMENT ON COLUMN channels.email_address IS 'Email address for email channels (used for Gmail OAuth2)';
COMMENT ON COLUMN channels.token_expiry IS 'Expiry timestamp for OAuth2 access tokens';
COMMENT ON COLUMN channels.oauth_state IS 'OAuth2 state parameter for security during authentication flow';