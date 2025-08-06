/*
  # Add Campaign Name Field

  1. New Columns
    - `campaigns.name` (text) - Dedicated campaign name field

  2. Changes
    - Add name column to campaigns table
    - Set default value for existing campaigns
    - Update campaign display logic to use name first, then offer as fallback

  3. Benefits
    - Proper campaign naming separate from offer description
    - Better campaign organization and identification
    - Cleaner UI with dedicated names
*/

-- Add name column to campaigns table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'name'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN name text;
  END IF;
END $$;

-- Update existing campaigns to use offer as name if name is null
UPDATE campaigns 
SET name = offer 
WHERE name IS NULL AND offer IS NOT NULL;

-- Set a default name for campaigns with no offer
UPDATE campaigns 
SET name = 'Untitled Campaign' 
WHERE name IS NULL;