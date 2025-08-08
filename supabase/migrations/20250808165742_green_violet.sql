/*
  # Sync Campaign Leads to Lists

  1. Purpose
    - Sync existing campaign leads to their corresponding lists
    - Create missing campaign lists for existing campaigns
    - Ensure all campaign leads appear in lists

  2. Changes
    - Create lists for campaigns that don't have them
    - Copy uploaded_leads to list_leads for campaign lists
    - Maintain sync between campaign uploads and lists
*/

-- First, create lists for campaigns that don't have them
INSERT INTO lists (user_id, name, description, tags)
SELECT DISTINCT 
  c.user_id,
  COALESCE(c.offer, c.name, 'Campaign List') as name,
  'Auto-created list for campaign: ' || COALESCE(c.offer, c.name, 'Untitled Campaign') as description,
  ARRAY['campaign', 'auto-created'] as tags
FROM campaigns c
WHERE NOT EXISTS (
  SELECT 1 FROM lists l 
  WHERE l.name = COALESCE(c.offer, c.name, 'Campaign List') 
  AND l.user_id = c.user_id
);

-- Sync all existing campaign leads to their corresponding lists
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
SELECT DISTINCT
  l.id as list_id,
  ul.user_id,
  ul.name,
  ul.email,
  ul.phone,
  ul.company_name,
  ul.job_title,
  ul.source_url,
  ul.source_platform,
  jsonb_build_object(
    'campaign_id', ul.campaign_id,
    'original_status', ul.status,
    'synced_from_campaign', true
  ) as custom_fields
FROM uploaded_leads ul
JOIN campaigns c ON c.id = ul.campaign_id
JOIN lists l ON l.name = COALESCE(c.offer, c.name, 'Campaign List') AND l.user_id = ul.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM list_leads ll 
  WHERE ll.list_id = l.id 
  AND ll.email = ul.email 
  AND ll.phone = ul.phone
);