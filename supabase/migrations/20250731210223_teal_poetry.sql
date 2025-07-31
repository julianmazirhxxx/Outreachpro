/*
  # Add name column to channels table

  1. Changes
    - Add `name` column to `channels` table with text type
    - Set default value for existing records
    - Make column NOT NULL after setting defaults

  2. Notes
    - This fixes the PGRST204 error where the 'name' column was missing
    - Existing channels will get a default name based on their channel type
*/

-- Add name column to channels table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channels' AND column_name = 'name'
  ) THEN
    -- Add the column as nullable first
    ALTER TABLE channels ADD COLUMN name text;
    
    -- Update existing records with default names based on channel type
    UPDATE channels 
    SET name = CASE 
      WHEN channel_type = 'voice' THEN 'Voice Channel'
      WHEN channel_type = 'sms' THEN 'SMS Channel'
      WHEN channel_type = 'whatsapp' THEN 'WhatsApp Channel'
      WHEN channel_type = 'email' THEN 'Email Channel'
      ELSE 'Unknown Channel'
    END
    WHERE name IS NULL;
    
    -- Now make the column NOT NULL
    ALTER TABLE channels ALTER COLUMN name SET NOT NULL;
  END IF;
END $$;