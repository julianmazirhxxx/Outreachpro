/*
  # Fix Email Tracking System

  1. Purpose
    - Ensure email tracking tables have proper structure
    - Add missing indexes for performance
    - Fix RLS policies for email tracking

  2. Tables Updated
    - email_tracking: Core email tracking records
    - email_events: Individual tracking events (opens, clicks, replies)
    - tracked_links: Link tracking records

  3. Security
    - Enable RLS on all tables
    - Add proper policies for user data access
    - Ensure foreign key constraints
*/

-- Ensure email_tracking table has all required columns
DO $$
BEGIN
  -- Add missing columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_tracking' AND column_name = 'message_id'
  ) THEN
    ALTER TABLE email_tracking ADD COLUMN message_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_tracking' AND column_name = 'provider'
  ) THEN
    ALTER TABLE email_tracking ADD COLUMN provider text DEFAULT 'smtp';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_tracking' AND column_name = 'status'
  ) THEN
    ALTER TABLE email_tracking ADD COLUMN status text DEFAULT 'sent';
  END IF;
END $$;

-- Ensure email_events table has proper structure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_events' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE email_events ADD COLUMN metadata jsonb;
  END IF;
END $$;

-- Ensure tracked_links table exists
CREATE TABLE IF NOT EXISTS tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id text NOT NULL,
  original_url text NOT NULL,
  tracking_url text NOT NULL UNIQUE,
  link_text text,
  position_in_email integer,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_tracking_tracking_id ON email_tracking(tracking_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_campaign_lead ON email_tracking(campaign_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_email_events_tracking_id ON email_events(tracking_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracked_links_tracking_id ON tracked_links(tracking_id);

-- Enable RLS on all tracking tables
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_tracking
DROP POLICY IF EXISTS "Users can manage their email tracking" ON email_tracking;
CREATE POLICY "Users can manage their email tracking"
  ON email_tracking
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for email_events
DROP POLICY IF EXISTS "Users can view events for their emails" ON email_events;
CREATE POLICY "Users can view events for their emails"
  ON email_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_tracking
      WHERE email_tracking.tracking_id = email_events.tracking_id
      AND email_tracking.user_id = auth.uid()
    )
  );

-- RLS Policies for tracked_links
DROP POLICY IF EXISTS "Users can manage links for their emails" ON tracked_links;
CREATE POLICY "Users can manage links for their emails"
  ON tracked_links
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_tracking
      WHERE email_tracking.tracking_id = tracked_links.tracking_id
      AND email_tracking.user_id = auth.uid()
    )
  );

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  -- email_events -> email_tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_email_events_tracking_id'
  ) THEN
    ALTER TABLE email_events
    ADD CONSTRAINT fk_email_events_tracking_id
    FOREIGN KEY (tracking_id) REFERENCES email_tracking(tracking_id) ON DELETE CASCADE;
  END IF;

  -- tracked_links -> email_tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tracked_links_tracking_id'
  ) THEN
    ALTER TABLE tracked_links
    ADD CONSTRAINT fk_tracked_links_tracking_id
    FOREIGN KEY (tracking_id) REFERENCES email_tracking(tracking_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add check constraints for data integrity
DO $$
BEGIN
  -- email_events event_type constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'email_events_event_type_check'
  ) THEN
    ALTER TABLE email_events
    ADD CONSTRAINT email_events_event_type_check
    CHECK (event_type IN ('open', 'click', 'reply', 'bounce', 'delivery', 'spam'));
  END IF;

  -- email_tracking status constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'email_tracking_status_check'
  ) THEN
    ALTER TABLE email_tracking
    ADD CONSTRAINT email_tracking_status_check
    CHECK (status IN ('sent', 'delivered', 'bounced', 'failed'));
  END IF;
END $$;