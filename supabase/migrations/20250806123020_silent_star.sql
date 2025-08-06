/*
  # Email Throttling System

  1. New Tables
    - `email_throttling_state` - Track last email sent time per sender
    - Add throttling fields to existing tables

  2. Functions
    - `check_email_throttling()` - Validate 5-minute minimum delay
    - `update_email_throttling_state()` - Update last sent timestamp

  3. Security
    - Enable RLS on new tables
    - Add policies for user access only

  4. Features
    - Minimum 5-minute delay between emails from same sender
    - Automatic throttling validation
    - Sender reputation protection
*/

-- Create email throttling state table
CREATE TABLE IF NOT EXISTS email_throttling_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_email text NOT NULL,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  last_email_sent_at timestamptz DEFAULT now(),
  emails_sent_today integer DEFAULT 0,
  daily_limit integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, sender_email)
);

-- Enable RLS
ALTER TABLE email_throttling_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own email throttling state"
  ON email_throttling_state
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_throttling_user_sender 
  ON email_throttling_state(user_id, sender_email);

CREATE INDEX IF NOT EXISTS idx_email_throttling_last_sent 
  ON email_throttling_state(last_email_sent_at);

-- Function to check if email can be sent (5-minute throttling)
CREATE OR REPLACE FUNCTION check_email_throttling(
  p_user_id uuid,
  p_sender_email text,
  p_channel_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_last_sent timestamptz;
  v_emails_today integer;
  v_daily_limit integer;
  v_time_since_last interval;
  v_can_send boolean := true;
  v_wait_seconds integer := 0;
  v_result jsonb;
BEGIN
  -- Get current throttling state
  SELECT 
    last_email_sent_at,
    emails_sent_today,
    daily_limit
  INTO 
    v_last_sent,
    v_emails_today,
    v_daily_limit
  FROM email_throttling_state
  WHERE user_id = p_user_id AND sender_email = p_sender_email;

  -- If no record exists, create one
  IF v_last_sent IS NULL THEN
    INSERT INTO email_throttling_state (
      user_id, 
      sender_email, 
      channel_id,
      last_email_sent_at,
      emails_sent_today,
      daily_limit
    ) VALUES (
      p_user_id, 
      p_sender_email, 
      p_channel_id,
      now() - interval '6 minutes', -- Allow immediate first send
      0,
      100
    );
    
    v_last_sent := now() - interval '6 minutes';
    v_emails_today := 0;
    v_daily_limit := 100;
  END IF;

  -- Reset daily counter if it's a new day
  IF DATE(v_last_sent) < CURRENT_DATE THEN
    v_emails_today := 0;
  END IF;

  -- Check 5-minute throttling
  v_time_since_last := now() - v_last_sent;
  
  IF v_time_since_last < interval '5 minutes' THEN
    v_can_send := false;
    v_wait_seconds := EXTRACT(EPOCH FROM (interval '5 minutes' - v_time_since_last))::integer;
  END IF;

  -- Check daily limit
  IF v_emails_today >= v_daily_limit THEN
    v_can_send := false;
    v_wait_seconds := GREATEST(v_wait_seconds, 
      EXTRACT(EPOCH FROM (CURRENT_DATE + interval '1 day' - now()))::integer);
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'can_send', v_can_send,
    'wait_seconds', v_wait_seconds,
    'wait_minutes', ROUND(v_wait_seconds / 60.0, 1),
    'last_sent_at', v_last_sent,
    'emails_sent_today', v_emails_today,
    'daily_limit', v_daily_limit,
    'time_since_last_minutes', ROUND(EXTRACT(EPOCH FROM v_time_since_last) / 60.0, 1)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update throttling state after sending email
CREATE OR REPLACE FUNCTION update_email_throttling_state(
  p_user_id uuid,
  p_sender_email text,
  p_channel_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Update or insert throttling state
  INSERT INTO email_throttling_state (
    user_id,
    sender_email,
    channel_id,
    last_email_sent_at,
    emails_sent_today,
    updated_at
  ) VALUES (
    p_user_id,
    p_sender_email,
    p_channel_id,
    now(),
    1,
    now()
  )
  ON CONFLICT (user_id, sender_email) 
  DO UPDATE SET
    last_email_sent_at = now(),
    emails_sent_today = CASE 
      WHEN DATE(email_throttling_state.last_email_sent_at) < CURRENT_DATE 
      THEN 1 
      ELSE email_throttling_state.emails_sent_today + 1 
    END,
    updated_at = now(),
    channel_id = COALESCE(p_channel_id, email_throttling_state.channel_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add throttling check to campaign sequences
ALTER TABLE campaign_sequences 
ADD COLUMN IF NOT EXISTS min_delay_minutes integer DEFAULT 5;

-- Update existing email sequences to have 5-minute minimum delay
UPDATE campaign_sequences 
SET min_delay_minutes = 5 
WHERE type = 'email' AND min_delay_minutes IS NULL;

-- Add comment explaining the throttling system
COMMENT ON TABLE email_throttling_state IS 'Email throttling system to prevent spam and protect sender reputation. Enforces minimum 5-minute delays between emails from the same sender.';

COMMENT ON FUNCTION check_email_throttling IS 'Checks if an email can be sent based on throttling rules. Returns can_send boolean and wait time if throttled.';

COMMENT ON FUNCTION update_email_throttling_state IS 'Updates the throttling state after successfully sending an email. Increments daily counter and updates last sent timestamp.';