/*
  # Create Lists Infrastructure

  1. New Tables
    - `lists` - Independent lead collections (separate from campaigns)
    - `list_leads` - Leads within lists (separate from campaign leads)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage their own lists and leads

  3. Indexes
    - Performance indexes for common queries
    - Unique constraints to prevent duplicates within lists
*/

-- Create lists table
CREATE TABLE IF NOT EXISTS lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create list_leads table
CREATE TABLE IF NOT EXISTS list_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  company_name text,
  job_title text,
  source_url text,
  source_platform text,
  custom_fields jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Prevent duplicate leads within the same list (by email or phone)
  CONSTRAINT unique_email_per_list UNIQUE(list_id, email),
  CONSTRAINT unique_phone_per_list UNIQUE(list_id, phone)
);

-- Enable RLS
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lists
CREATE POLICY "Users can manage their own lists"
  ON lists
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for list_leads
CREATE POLICY "Users can manage leads in their own lists"
  ON list_leads
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_created_at ON lists(created_at);
CREATE INDEX IF NOT EXISTS idx_lists_name ON lists(name);

CREATE INDEX IF NOT EXISTS idx_list_leads_list_id ON list_leads(list_id);
CREATE INDEX IF NOT EXISTS idx_list_leads_user_id ON list_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_list_leads_email ON list_leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_list_leads_phone ON list_leads(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_list_leads_company ON list_leads(company_name) WHERE company_name IS NOT NULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to lists table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_lists_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_lists_updated_at_trigger
      BEFORE UPDATE ON lists
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Apply trigger to list_leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_list_leads_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_list_leads_updated_at_trigger
      BEFORE UPDATE ON list_leads
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;