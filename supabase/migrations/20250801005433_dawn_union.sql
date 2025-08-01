/*
  # Centralize uploaded_leads as the main lead table

  This migration makes uploaded_leads the central hub for all lead-related data by:
  1. Updating foreign key relationships to point to uploaded_leads
  2. Migrating existing data to maintain referential integrity
  3. Updating the ready_sequence_tasks view
  4. Adding proper indexes for performance

  ## Changes Made:
  1. **lead_activity_history**: Now references uploaded_leads.id
  2. **conversation_history**: Now references uploaded_leads.id  
  3. **bookings**: Now references uploaded_leads.id
  4. **lead_sequence_progress**: Already references uploaded_leads.id
  5. **ready_sequence_tasks**: Updated to use uploaded_leads data
  6. **Data Migration**: Existing records updated to maintain integrity
  7. **Performance**: Added indexes for new foreign key relationships

  ## Benefits:
  - Single source of truth for lead data
  - Complete lead context (company, job title, source, etc.)
  - Simplified data model
  - Better performance with proper indexing
  - Easier maintenance and debugging
*/

-- Step 1: Add temporary columns to store uploaded_leads IDs
ALTER TABLE lead_activity_history ADD COLUMN IF NOT EXISTS uploaded_lead_id uuid;
ALTER TABLE conversation_history ADD COLUMN IF NOT EXISTS uploaded_lead_id uuid;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS uploaded_lead_id uuid;

-- Step 2: Migrate existing data by matching phone numbers and campaign_id
-- This handles the case where leads table and uploaded_leads have the same leads

-- Update lead_activity_history
UPDATE lead_activity_history 
SET uploaded_lead_id = ul.id
FROM uploaded_leads ul, leads l
WHERE lead_activity_history.lead_id = l.id 
  AND l.phone = ul.phone 
  AND l.campaign_id = ul.campaign_id
  AND ul.phone IS NOT NULL 
  AND ul.phone != ''
  AND ul.phone != 'EMPTY';

-- Update conversation_history  
UPDATE conversation_history 
SET uploaded_lead_id = ul.id
FROM uploaded_leads ul, leads l
WHERE conversation_history.lead_id = l.id 
  AND l.phone = ul.phone 
  AND l.campaign_id = ul.campaign_id
  AND ul.phone IS NOT NULL 
  AND ul.phone != ''
  AND ul.phone != 'EMPTY';

-- Update bookings
UPDATE bookings 
SET uploaded_lead_id = ul.id
FROM uploaded_leads ul, leads l
WHERE bookings.lead_id = l.id 
  AND l.phone = ul.phone 
  AND l.campaign_id = ul.campaign_id
  AND ul.phone IS NOT NULL 
  AND ul.phone != ''
  AND ul.phone != 'EMPTY';

-- Step 3: Drop old foreign key constraints
DO $$
BEGIN
  -- Drop foreign key constraints if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'lead_activity_history_lead_id_fkey'
  ) THEN
    ALTER TABLE lead_activity_history DROP CONSTRAINT lead_activity_history_lead_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'conversation_history_lead_id_fkey'
  ) THEN
    ALTER TABLE conversation_history DROP CONSTRAINT conversation_history_lead_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bookings_lead_id_fkey'
  ) THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_lead_id_fkey;
  END IF;
END $$;

-- Step 4: Rename columns to use uploaded_leads references
ALTER TABLE lead_activity_history DROP COLUMN IF EXISTS lead_id;
ALTER TABLE lead_activity_history RENAME COLUMN uploaded_lead_id TO lead_id;

ALTER TABLE conversation_history DROP COLUMN IF EXISTS lead_id;
ALTER TABLE conversation_history RENAME COLUMN uploaded_lead_id TO lead_id;

ALTER TABLE bookings DROP COLUMN IF EXISTS lead_id;
ALTER TABLE bookings RENAME COLUMN uploaded_lead_id TO lead_id;

-- Step 5: Add new foreign key constraints pointing to uploaded_leads
ALTER TABLE lead_activity_history 
ADD CONSTRAINT lead_activity_history_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES uploaded_leads(id) ON DELETE CASCADE;

ALTER TABLE conversation_history 
ADD CONSTRAINT conversation_history_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES uploaded_leads(id) ON DELETE CASCADE;

ALTER TABLE bookings 
ADD CONSTRAINT bookings_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES uploaded_leads(id) ON DELETE CASCADE;

-- Step 6: Update ready_sequence_tasks view to use uploaded_leads
DROP VIEW IF EXISTS ready_sequence_tasks;

CREATE VIEW ready_sequence_tasks AS
SELECT 
  lsp.id as task_id,
  lsp.lead_id,
  lsp.campaign_id,
  lsp.step,
  lsp.next_at,
  lsp.user_id,
  cs.type as channel_type,
  cs.prompt,
  cs.email_subject,
  cs.email_template,
  cs.wait_seconds,
  -- Lead information from uploaded_leads (complete data)
  ul.name as lead_name,
  ul.phone as lead_phone,
  ul.email as lead_email,
  ul.company_name,
  ul.job_title,
  -- Campaign information
  c.offer as campaign_offer,
  c.calendar_url
FROM lead_sequence_progress lsp
JOIN campaign_sequences cs ON cs.campaign_id = lsp.campaign_id AND cs.step_number = lsp.step
JOIN uploaded_leads ul ON ul.id = lsp.lead_id
JOIN campaigns c ON c.id = lsp.campaign_id
WHERE lsp.status = 'ready' 
  AND lsp.next_at <= NOW()
  AND ul.phone IS NOT NULL 
  AND ul.phone != '' 
  AND ul.phone != 'EMPTY';

-- Step 7: Add performance indexes for the new foreign key relationships
CREATE INDEX IF NOT EXISTS idx_lead_activity_history_uploaded_lead_id 
ON lead_activity_history(lead_id);

CREATE INDEX IF NOT EXISTS idx_conversation_history_uploaded_lead_id 
ON conversation_history(lead_id);

CREATE INDEX IF NOT EXISTS idx_bookings_uploaded_lead_id 
ON bookings(lead_id);

-- Step 8: Add index for phone number lookups (for data migration and deduplication)
CREATE INDEX IF NOT EXISTS idx_uploaded_leads_phone_campaign 
ON uploaded_leads(phone, campaign_id) WHERE phone IS NOT NULL AND phone != '' AND phone != 'EMPTY';

-- Step 9: Clean up orphaned records that couldn't be migrated
-- Remove records that don't have a corresponding uploaded_lead
DELETE FROM lead_activity_history WHERE lead_id IS NULL;
DELETE FROM conversation_history WHERE lead_id IS NULL;
DELETE FROM bookings WHERE lead_id IS NULL;

-- Step 10: Update RLS policies to work with uploaded_leads
DROP POLICY IF EXISTS "Users can view activity history for their campaigns" ON lead_activity_history;
CREATE POLICY "Users can view activity history for their campaigns" 
ON lead_activity_history FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM uploaded_leads ul 
    WHERE ul.id = lead_activity_history.lead_id 
    AND ul.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view conversation history for their campaigns" ON conversation_history;
CREATE POLICY "Users can view conversation history for their campaigns" 
ON conversation_history FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM uploaded_leads ul 
    WHERE ul.id = conversation_history.lead_id 
    AND ul.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage their own bookings" ON bookings;
CREATE POLICY "Users can manage their own bookings" 
ON bookings FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM uploaded_leads ul 
    WHERE ul.id = bookings.lead_id 
    AND ul.user_id = auth.uid()
  )
);

-- Step 11: Add helpful comments
COMMENT ON TABLE uploaded_leads IS 'Central lead table - all lead-related data references this table';
COMMENT ON COLUMN lead_activity_history.lead_id IS 'References uploaded_leads.id (central lead table)';
COMMENT ON COLUMN conversation_history.lead_id IS 'References uploaded_leads.id (central lead table)';
COMMENT ON COLUMN bookings.lead_id IS 'References uploaded_leads.id (central lead table)';
COMMENT ON VIEW ready_sequence_tasks IS 'n8n automation view - pulls complete lead data from uploaded_leads';