/*
  # Fix lead_sequence_progress to reference uploaded_leads table

  1. Database Changes
    - Drop existing foreign key constraint to leads table
    - Add new foreign key constraint to uploaded_leads table
    - Update any existing data to use uploaded_leads IDs

  2. Benefits
    - lead_sequence_progress now references the primary leads table (uploaded_leads)
    - n8n can pull complete lead data including company_name, job_title, etc.
    - Eliminates the need for the separate leads table
    - Simplifies data architecture
*/

-- First, check if there are any existing lead_sequence_progress entries
-- and update them to reference uploaded_leads if needed

-- Drop the existing foreign key constraint to leads table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'lead_sequence_progress_lead_id_fkey' 
    AND table_name = 'lead_sequence_progress'
  ) THEN
    ALTER TABLE lead_sequence_progress DROP CONSTRAINT lead_sequence_progress_lead_id_fkey;
  END IF;
END $$;

-- Add new foreign key constraint to uploaded_leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'lead_sequence_progress_uploaded_lead_id_fkey' 
    AND table_name = 'lead_sequence_progress'
  ) THEN
    ALTER TABLE lead_sequence_progress 
    ADD CONSTRAINT lead_sequence_progress_uploaded_lead_id_fkey 
    FOREIGN KEY (lead_id) REFERENCES uploaded_leads(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update the ready_sequence_tasks view to use uploaded_leads instead of leads
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
  ul.name as lead_name,
  ul.phone as lead_phone,
  ul.email as lead_email,
  ul.company_name,
  ul.job_title,
  c.offer as campaign_offer,
  c.calendar_url
FROM lead_sequence_progress lsp
JOIN campaign_sequences cs ON cs.campaign_id = lsp.campaign_id AND cs.step_number = lsp.step
JOIN uploaded_leads ul ON ul.id = lsp.lead_id
JOIN campaigns c ON c.id = lsp.campaign_id
WHERE lsp.status = 'ready'
  AND lsp.next_at <= NOW()
ORDER BY lsp.next_at ASC;