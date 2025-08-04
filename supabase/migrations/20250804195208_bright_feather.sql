/*
  # Email Support Migration

  1. New Tables
    - `email_templates` - Reusable email templates for campaigns
    - `email_deliverability` - Email health and reputation tracking

  2. Schema Updates
    - Add email support to channels and campaign_sequences
    - Add email tracking fields to leads tables
    - Add email-specific fields for conversation and activity history

  3. Security
    - Enable RLS on new tables
    - Add policies for user data access
    - Create proper indexes for performance

  4. Triggers
    - Add updated_at triggers for new tables
*/

-- Update channel type constraints to include email
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'channels_channel_type_check' 
    AND table_name = 'channels'
  ) THEN
    ALTER TABLE channels DROP CONSTRAINT channels_channel_type_check;
  END IF;
END $$;

ALTER TABLE channels ADD CONSTRAINT channels_channel_type_check 
CHECK (channel_type = ANY (ARRAY['voice'::text, 'sms'::text, 'whatsapp'::text, 'email'::text]));

-- Update campaign sequence type constraints to include email
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'campaign_sequences_type_check' 
    AND table_name = 'campaign_sequences'
  ) THEN
    ALTER TABLE campaign_sequences DROP CONSTRAINT campaign_sequences_type_check;
  END IF;
END $$;

ALTER TABLE campaign_sequences ADD CONSTRAINT campaign_sequences_type_check 
CHECK (type = ANY (ARRAY['call'::text, 'sms'::text, 'whatsapp'::text, 'email'::text]));

-- Add email-specific fields to campaign_sequences if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_sequences' AND column_name = 'email_subject'
  ) THEN
    ALTER TABLE campaign_sequences ADD COLUMN email_subject text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_sequences' AND column_name = 'email_template'
  ) THEN
    ALTER TABLE campaign_sequences ADD COLUMN email_template text;
  END IF;
END $$;

-- Add email-specific fields to conversation_history if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_history' AND column_name = 'email_subject'
  ) THEN
    ALTER TABLE conversation_history ADD COLUMN email_subject text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_history' AND column_name = 'email_body'
  ) THEN
    ALTER TABLE conversation_history ADD COLUMN email_body text;
  END IF;
END $$;

-- Add email-specific fields to lead_activity_history if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_activity_history' AND column_name = 'email_subject'
  ) THEN
    ALTER TABLE lead_activity_history ADD COLUMN email_subject text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_activity_history' AND column_name = 'email_body'
  ) THEN
    ALTER TABLE lead_activity_history ADD COLUMN email_body text;
  END IF;
END $$;

-- Create email templates table for reusable email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  template_type text DEFAULT 'custom' CHECK (template_type = ANY (ARRAY['custom'::text, 'follow_up'::text, 'initial'::text, 'booking_confirmation'::text])),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Enable RLS on email_templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_templates
CREATE POLICY "Users can manage their own email templates"
  ON email_templates
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes for email_templates
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_campaign_id ON email_templates USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates USING btree (is_active) WHERE is_active = true;

-- Add email tracking fields to uploaded_leads if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploaded_leads' AND column_name = 'emails_sent_this_week'
  ) THEN
    ALTER TABLE uploaded_leads ADD COLUMN emails_sent_this_week integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploaded_leads' AND column_name = 'last_email_sent_at'
  ) THEN
    ALTER TABLE uploaded_leads ADD COLUMN last_email_sent_at timestamptz;
  END IF;
END $$;

-- Add email tracking fields to leads if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'emails_sent_this_week'
  ) THEN
    ALTER TABLE leads ADD COLUMN emails_sent_this_week integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'last_email_sent_at'
  ) THEN
    ALTER TABLE leads ADD COLUMN last_email_sent_at timestamptz;
  END IF;
END $$;

-- Add weekly email limits to campaigns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'weekly_email_limit'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN weekly_email_limit integer DEFAULT 50;
  END IF;
END $$;

-- Create email_deliverability table for tracking email health
CREATE TABLE IF NOT EXISTS email_deliverability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  date date DEFAULT CURRENT_DATE,
  emails_sent integer DEFAULT 0,
  emails_delivered integer DEFAULT 0,
  emails_opened integer DEFAULT 0,
  emails_clicked integer DEFAULT 0,
  emails_bounced integer DEFAULT 0,
  emails_complained integer DEFAULT 0,
  reputation_score decimal(3,2) DEFAULT 100.00,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz DEFAULT timezone('utc'::text, now()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  UNIQUE(channel_id, date)
);

-- Enable RLS on email_deliverability
ALTER TABLE email_deliverability ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_deliverability
CREATE POLICY "Users can view their own email deliverability"
  ON email_deliverability
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes for email_deliverability
CREATE INDEX IF NOT EXISTS idx_email_deliverability_user_id ON email_deliverability USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_email_deliverability_channel_id ON email_deliverability USING btree (channel_id);
CREATE INDEX IF NOT EXISTS idx_email_deliverability_date ON email_deliverability USING btree (date);

-- Create or replace trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_email_templates_updated_at_trigger ON email_templates;
CREATE TRIGGER update_email_templates_updated_at_trigger
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_deliverability_updated_at_trigger ON email_deliverability;
CREATE TRIGGER update_email_deliverability_updated_at_trigger
    BEFORE UPDATE ON email_deliverability
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();