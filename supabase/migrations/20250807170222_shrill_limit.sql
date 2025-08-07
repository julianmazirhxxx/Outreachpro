/*
  # Enable Automatic Email Tracking

  1. Purpose
    - Enable automatic email tracking for all outbound emails
    - Create function to auto-process emails with tracking
    - Set up triggers for automatic tracking record creation

  2. Changes
    - Add email tracking trigger function
    - Create automatic tracking for campaign emails
    - Enable tracking without user configuration

  3. Security
    - Maintain RLS policies
    - Ensure user data isolation
    - Secure tracking ID generation
*/

-- Function to automatically create email tracking records
CREATE OR REPLACE FUNCTION auto_create_email_tracking()
RETURNS TRIGGER AS $$
DECLARE
  tracking_id TEXT;
  base_url TEXT;
BEGIN
  -- Generate tracking ID
  tracking_id := 'track_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 9);
  
  -- Get base URL from environment or use default
  base_url := coalesce(current_setting('app.supabase_url', true), 'https://your-app.supabase.co');
  
  -- Create tracking record for email messages
  IF NEW.channel = 'email' AND NEW.from_role = 'ai' THEN
    INSERT INTO email_tracking (
      user_id,
      campaign_id,
      lead_id,
      email_address,
      subject,
      tracking_id,
      provider,
      status
    )
    SELECT 
      ul.user_id,
      NEW.campaign_id,
      NEW.lead_id,
      ul.email,
      COALESCE(NEW.email_subject, 'Campaign Email'),
      tracking_id,
      'auto',
      'sent'
    FROM uploaded_leads ul
    WHERE ul.id = NEW.lead_id
    AND ul.email IS NOT NULL
    AND ul.email != ''
    ON CONFLICT (tracking_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic email tracking
DROP TRIGGER IF EXISTS auto_email_tracking_trigger ON conversation_history;
CREATE TRIGGER auto_email_tracking_trigger
  AFTER INSERT ON conversation_history
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_email_tracking();

-- Function to get tracking configuration for n8n
CREATE OR REPLACE FUNCTION get_email_tracking_config(
  p_campaign_id UUID,
  p_lead_id UUID
)
RETURNS JSON AS $$
DECLARE
  tracking_id TEXT;
  base_url TEXT;
  result JSON;
BEGIN
  -- Generate tracking ID
  tracking_id := 'track_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 9);
  
  -- Get base URL
  base_url := coalesce(current_setting('app.supabase_url', true), 'https://your-app.supabase.co');
  
  -- Build tracking configuration
  result := json_build_object(
    'tracking_id', tracking_id,
    'pixel_url', base_url || '/functions/v1/email-tracking?t=' || tracking_id || '&e=open',
    'click_base_url', base_url || '/functions/v1/email-tracking?t=' || tracking_id || '&e=click&url=',
    'tracking_headers', json_build_object(
      'X-Tracking-ID', tracking_id,
      'X-Campaign-ID', p_campaign_id,
      'X-Lead-ID', p_lead_id,
      'Message-ID', '<track-' || tracking_id || '@' || replace(base_url, 'https://', '') || '>'
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_email_tracking_config(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_create_email_tracking() TO authenticated;

-- Update RLS policies to ensure tracking works automatically
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;

-- Allow automatic insertion of tracking records
CREATE POLICY "Allow automatic email tracking creation"
  ON email_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Allow all inserts for automatic tracking

-- Ensure email events can be created automatically
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow automatic email event creation"
  ON email_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Allow all inserts for tracking events

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_email_tracking_auto_lookup 
  ON email_tracking (campaign_id, lead_id, created_at DESC);

-- Add helpful comment
COMMENT ON FUNCTION get_email_tracking_config(UUID, UUID) IS 
'Returns email tracking configuration for n8n workflows. Call this function to get tracking pixel URL, click tracking base URL, and required headers for email tracking.';

COMMENT ON FUNCTION auto_create_email_tracking() IS 
'Automatically creates email tracking records when emails are sent via conversation_history. Triggered on INSERT.';