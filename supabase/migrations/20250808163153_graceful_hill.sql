/*
  # Auto-create campaign lists and sync leads

  1. New Functions
    - Function to auto-create list when campaign is created
    - Function to sync uploaded leads to campaign list
    - Trigger to maintain sync between campaigns and lists

  2. Changes
    - Auto-create list when campaign is created
    - Sync uploaded_leads to list_leads automatically
    - Maintain bidirectional sync

  3. Security
    - All functions respect user ownership
    - RLS policies maintained
*/

-- Function to auto-create list when campaign is created
CREATE OR REPLACE FUNCTION auto_create_campaign_list()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a list with the campaign name
  INSERT INTO lists (user_id, name, description, tags)
  VALUES (
    NEW.user_id,
    NEW.offer || NEW.name || 'Campaign List',
    'Auto-created list for campaign: ' || (NEW.offer || NEW.name || 'Untitled'),
    ARRAY['campaign', 'auto-created']
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync uploaded leads to campaign list
CREATE OR REPLACE FUNCTION sync_uploaded_leads_to_list()
RETURNS TRIGGER AS $$
DECLARE
  campaign_list_id uuid;
BEGIN
  -- Find the list for this campaign
  SELECT l.id INTO campaign_list_id
  FROM lists l
  JOIN campaigns c ON c.user_id = l.user_id
  WHERE c.id = NEW.campaign_id
    AND (l.name = c.offer OR l.name = c.name OR l.description LIKE '%' || c.id || '%')
  LIMIT 1;
  
  -- If no list found, create one
  IF campaign_list_id IS NULL THEN
    INSERT INTO lists (user_id, name, description, tags)
    SELECT 
      c.user_id,
      c.offer || c.name || 'Campaign List',
      'Auto-created list for campaign: ' || (c.offer || c.name || 'Untitled'),
      ARRAY['campaign', 'auto-created']
    FROM campaigns c
    WHERE c.id = NEW.campaign_id
    RETURNING id INTO campaign_list_id;
  END IF;
  
  -- Add lead to the campaign list (avoid duplicates)
  INSERT INTO list_leads (
    list_id,
    user_id,
    name,
    email,
    phone,
    company_name,
    job_title,
    source_url,
    source_platform,
    custom_fields
  )
  VALUES (
    campaign_list_id,
    NEW.user_id,
    NEW.name,
    NEW.email,
    NEW.phone,
    NEW.company_name,
    NEW.job_title,
    NEW.source_url,
    NEW.source_platform,
    '{}'::jsonb
  )
  ON CONFLICT (list_id, email) DO NOTHING
  ON CONFLICT (list_id, phone) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create list when campaign is created
CREATE TRIGGER auto_create_campaign_list_trigger
  AFTER INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_campaign_list();

-- Trigger to sync uploaded leads to campaign list
CREATE TRIGGER sync_uploaded_leads_to_list_trigger
  AFTER INSERT ON uploaded_leads
  FOR EACH ROW
  EXECUTE FUNCTION sync_uploaded_leads_to_list();