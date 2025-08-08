/*
  # Auto-create Lists for Campaigns

  1. Purpose
    - Automatically create a list when a campaign is created
    - Sync uploaded leads from campaigns to their corresponding lists
    - Maintain separation between Lists (lead collection) and Campaigns (activation)

  2. Changes
    - Add trigger to auto-create list when campaign is created
    - Add trigger to sync uploaded_leads to list_leads
    - Ensure proper relationships and constraints

  3. Workflow
    - User creates campaign → List auto-created with campaign name
    - User uploads leads to campaign → Leads auto-synced to campaign list
    - User can also create independent lists and upload directly
    - User can move leads from lists to campaigns when ready
*/

-- Function to auto-create list when campaign is created
CREATE OR REPLACE FUNCTION auto_create_campaign_list()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a corresponding list for the new campaign
  INSERT INTO lists (
    user_id,
    name,
    description,
    tags,
    created_at,
    updated_at
  ) VALUES (
    NEW.user_id,
    NEW.name || NEW.offer || 'Campaign List',
    'Auto-created list for campaign: ' || (NEW.offer || NEW.name || 'Untitled Campaign'),
    ARRAY['campaign', 'auto-created'],
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create list when campaign is created
DROP TRIGGER IF EXISTS auto_create_campaign_list_trigger ON campaigns;
CREATE TRIGGER auto_create_campaign_list_trigger
  AFTER INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_campaign_list();

-- Function to sync uploaded leads to campaign list
CREATE OR REPLACE FUNCTION sync_uploaded_leads_to_list()
RETURNS TRIGGER AS $$
DECLARE
  campaign_list_id UUID;
BEGIN
  -- Find the list that corresponds to this campaign
  SELECT l.id INTO campaign_list_id
  FROM lists l
  JOIN campaigns c ON (
    l.user_id = c.user_id AND 
    (l.name = c.name OR l.name = c.offer OR l.name = 'Campaign List') AND
    l.tags @> ARRAY['campaign', 'auto-created']
  )
  WHERE c.id = NEW.campaign_id
  LIMIT 1;
  
  -- If we found a matching campaign list, sync the lead
  IF campaign_list_id IS NOT NULL THEN
    -- Check if lead already exists in the list (prevent duplicates)
    IF NOT EXISTS (
      SELECT 1 FROM list_leads 
      WHERE list_id = campaign_list_id 
      AND user_id = NEW.user_id
      AND (
        (email IS NOT NULL AND email = NEW.email) OR
        (phone IS NOT NULL AND phone = NEW.phone AND phone != '')
      )
    ) THEN
      -- Insert into list_leads
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
        custom_fields,
        created_at,
        updated_at
      ) VALUES (
        campaign_list_id,
        NEW.user_id,
        NEW.name,
        NEW.email,
        NEW.phone,
        NEW.company_name,
        NEW.job_title,
        NEW.source_url,
        NEW.source_platform,
        '{}',
        NEW.created_at,
        NEW.updated_at
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync uploaded leads to campaign list
DROP TRIGGER IF EXISTS sync_uploaded_leads_to_list_trigger ON uploaded_leads;
CREATE TRIGGER sync_uploaded_leads_to_list_trigger
  AFTER INSERT ON uploaded_leads
  FOR EACH ROW
  EXECUTE FUNCTION sync_uploaded_leads_to_list();

-- Update existing campaigns to have corresponding lists
DO $$
DECLARE
  campaign_record RECORD;
  list_exists BOOLEAN;
BEGIN
  FOR campaign_record IN 
    SELECT id, user_id, name, offer 
    FROM campaigns 
    WHERE user_id IS NOT NULL
  LOOP
    -- Check if a list already exists for this campaign
    SELECT EXISTS(
      SELECT 1 FROM lists 
      WHERE user_id = campaign_record.user_id 
      AND (name = campaign_record.name OR name = campaign_record.offer OR name = 'Campaign List')
      AND tags @> ARRAY['campaign', 'auto-created']
    ) INTO list_exists;
    
    -- Create list if it doesn't exist
    IF NOT list_exists THEN
      INSERT INTO lists (
        user_id,
        name,
        description,
        tags,
        created_at,
        updated_at
      ) VALUES (
        campaign_record.user_id,
        campaign_record.name || campaign_record.offer || 'Campaign List',
        'Auto-created list for campaign: ' || (campaign_record.offer || campaign_record.name || 'Untitled Campaign'),
        ARRAY['campaign', 'auto-created'],
        NOW(),
        NOW()
      );
    END IF;
  END LOOP;
END $$;