/*
  # Force cleanup for live test campaign

  This migration removes ALL data from other campaigns except the live test campaign
  to ensure clean operation of the n8n automation engine.

  1. Target Campaign to Keep
    - Campaign ID: be239e0b-d75e-4ffc-ba0c-b693d157cb89
    - "Get 15 Free Qualified Car Buyer Leads + AI Follow-up Assistant for Your Dealership"

  2. Tables to Clean
    - lead_sequence_progress (critical for n8n engine)
    - campaign_sequences
    - conversation_history
    - training_resources
    - bookings
    - uploaded_leads
    - campaigns (remove other campaigns entirely)

  3. Safety
    - Uses explicit campaign ID to prevent accidental deletion
    - Preserves all data for the target campaign
*/

-- First, let's see what we're working with (for logging)
DO $$
DECLARE
    target_campaign_id uuid := 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';
    other_campaigns_count integer;
    target_sequences_count integer;
    other_sequences_count integer;
BEGIN
    -- Count other campaigns
    SELECT COUNT(*) INTO other_campaigns_count
    FROM campaigns 
    WHERE id != target_campaign_id;
    
    -- Count sequence progress for target campaign
    SELECT COUNT(*) INTO target_sequences_count
    FROM lead_sequence_progress 
    WHERE campaign_id = target_campaign_id;
    
    -- Count sequence progress for other campaigns
    SELECT COUNT(*) INTO other_sequences_count
    FROM lead_sequence_progress 
    WHERE campaign_id != target_campaign_id;
    
    RAISE NOTICE 'Cleanup Summary:';
    RAISE NOTICE '- Target campaign sequences to keep: %', target_sequences_count;
    RAISE NOTICE '- Other campaign sequences to remove: %', other_sequences_count;
    RAISE NOTICE '- Other campaigns to remove: %', other_campaigns_count;
END $$;

-- Remove lead_sequence_progress for other campaigns (CRITICAL for n8n)
DELETE FROM lead_sequence_progress 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove conversation_history for other campaigns
DELETE FROM conversation_history 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove training_resources for other campaigns
DELETE FROM training_resources 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove bookings for other campaigns
DELETE FROM bookings 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove campaign_sequences for other campaigns
DELETE FROM campaign_sequences 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove uploaded_leads for other campaigns
DELETE FROM uploaded_leads 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Finally, remove other campaigns entirely
DELETE FROM campaigns 
WHERE id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Verify cleanup
DO $$
DECLARE
    remaining_campaigns integer;
    remaining_sequences integer;
    target_sequences integer;
BEGIN
    SELECT COUNT(*) INTO remaining_campaigns FROM campaigns;
    SELECT COUNT(*) INTO remaining_sequences FROM lead_sequence_progress;
    SELECT COUNT(*) INTO target_sequences 
    FROM lead_sequence_progress 
    WHERE campaign_id = 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';
    
    RAISE NOTICE 'Cleanup Complete:';
    RAISE NOTICE '- Total campaigns remaining: %', remaining_campaigns;
    RAISE NOTICE '- Total sequence progress entries: %', remaining_sequences;
    RAISE NOTICE '- Target campaign sequence entries: %', target_sequences;
    
    IF remaining_campaigns != 1 THEN
        RAISE WARNING 'Expected 1 campaign, found %', remaining_campaigns;
    END IF;
    
    IF remaining_sequences != target_sequences THEN
        RAISE WARNING 'Sequence progress mismatch: total=%, target=%', remaining_sequences, target_sequences;
    END IF;
END $$;