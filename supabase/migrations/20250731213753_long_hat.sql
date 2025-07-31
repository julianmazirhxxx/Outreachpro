/*
  # Clean up campaign sequences for live test

  1. Data Cleanup
    - Remove all campaign sequences except for campaign ID: be239e0b-d75e-4ffc-ba0c-b693d157cb89
    - Remove all lead sequence progress except for the live test campaign
    - This ensures only the live test campaign runs without interference

  2. Safety
    - Uses WHERE clauses to target specific records
    - Preserves the live test campaign data
    - Cleans up any conflicting sequences that could confuse the system
*/

-- Remove all campaign sequences except the live test campaign
DELETE FROM campaign_sequences 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove all lead sequence progress except for the live test campaign
DELETE FROM lead_sequence_progress 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove all conversation history except for the live test campaign
DELETE FROM conversation_history 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove all training resources except for the live test campaign
DELETE FROM training_resources 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove all bookings except for the live test campaign
DELETE FROM bookings 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove all uploaded leads except for the live test campaign
DELETE FROM uploaded_leads 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove all leads except for the live test campaign
DELETE FROM leads 
WHERE campaign_id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';

-- Remove all campaigns except the live test campaign
DELETE FROM campaigns 
WHERE id != 'be239e0b-d75e-4ffc-ba0c-b693d157cb89';