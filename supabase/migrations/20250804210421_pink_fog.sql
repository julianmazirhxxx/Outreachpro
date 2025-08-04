/*
  # Fix Gmail OAuth2 Credentials Storage

  1. Database Updates
    - Update channels table to properly store OAuth2 tokens
    - Add indexes for OAuth2 state and token expiry
    - Ensure credentials JSONB stores access_token, refresh_token, etc.

  2. Schema Changes
    - email_address: Gmail address from profile API
    - token_expiry: UTC timestamp for token expiration
    - oauth_state: Security state parameter for OAuth flow
    - credentials.access_token: For Gmail API authorization
    - credentials.refresh_token: For token refresh
    - credentials.email_provider: "gmail"

  3. Security
    - Indexes for efficient OAuth state lookup
    - Token expiry tracking for automatic refresh
*/

-- Add OAuth2 specific columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channels' AND column_name = 'email_address'
  ) THEN
    ALTER TABLE channels ADD COLUMN email_address text;
    COMMENT ON COLUMN channels.email_address IS 'Email address for email channels (used for Gmail OAuth2)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channels' AND column_name = 'token_expiry'
  ) THEN
    ALTER TABLE channels ADD COLUMN token_expiry timestamptz;
    COMMENT ON COLUMN channels.token_expiry IS 'Expiry timestamp for OAuth2 access tokens';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channels' AND column_name = 'oauth_state'
  ) THEN
    ALTER TABLE channels ADD COLUMN oauth_state text;
    COMMENT ON COLUMN channels.oauth_state IS 'OAuth2 state parameter for security during authentication flow';
  END IF;
END $$;

-- Add indexes for OAuth2 functionality
CREATE INDEX IF NOT EXISTS idx_channels_oauth_state 
ON channels (oauth_state) 
WHERE oauth_state IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channels_token_expiry 
ON channels (token_expiry) 
WHERE token_expiry IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channels_provider_type 
ON channels (provider, channel_type);

-- Update existing Gmail channels to use OAuth2 structure
UPDATE channels 
SET 
  provider = 'gmail',
  credentials = jsonb_build_object(
    'email_provider', 'gmail',
    'requires_oauth', true,
    'scope', 'https://www.googleapis.com/auth/gmail.send',
    'legacy_smtp', credentials
  )
WHERE channel_type = 'email' 
  AND (credentials->>'email_provider' IS NULL OR credentials->>'email_provider' != 'gmail')
  AND (credentials->>'email_username' LIKE '%@gmail.com' OR provider = 'gmail');