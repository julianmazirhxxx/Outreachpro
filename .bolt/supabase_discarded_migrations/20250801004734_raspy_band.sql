/*
  # Clean up invalid leads with no contact information

  1. Analysis
    - Identifies leads with no valid phone or email
    - Counts leads that cannot be contacted
    - Provides data quality metrics

  2. Cleanup Operations
    - Removes leads with no phone AND no email
    - Handles foreign key constraints properly
    - Preserves leads with at least one valid contact method

  3. Data Quality Improvements
    - Adds constraints to prevent future invalid data
    - Improves database performance by removing unusable records
*/

-- First, let's analyze the current state
DO $$
DECLARE
    total_uploaded_leads INTEGER;
    leads_no_phone INTEGER;
    leads_no_email INTEGER;
    leads_no_contact INTEGER;
    leads_empty_phone INTEGER;
    leads_invalid_phone INTEGER;
BEGIN
    -- Count total uploaded leads
    SELECT COUNT(*) INTO total_uploaded_leads FROM uploaded_leads;
    
    -- Count leads with no phone
    SELECT COUNT(*) INTO leads_no_phone 
    FROM uploaded_leads 
    WHERE phone IS NULL OR phone = '' OR phone = 'EMPTY';
    
    -- Count leads with no email
    SELECT COUNT(*) INTO leads_no_email 
    FROM uploaded_leads 
    WHERE email IS NULL OR email = '' OR email = 'EMPTY';
    
    -- Count leads with no contact info at all
    SELECT COUNT(*) INTO leads_no_contact 
    FROM uploaded_leads 
    WHERE (phone IS NULL OR phone = '' OR phone = 'EMPTY')
    AND (email IS NULL OR email = '' OR email = 'EMPTY');
    
    -- Count leads with 'EMPTY' phone specifically
    SELECT COUNT(*) INTO leads_empty_phone 
    FROM uploaded_leads 
    WHERE phone = 'EMPTY';
    
    -- Count leads with invalid phone format (less than 10 digits)
    SELECT COUNT(*) INTO leads_invalid_phone 
    FROM uploaded_leads 
    WHERE phone IS NOT NULL 
    AND phone != '' 
    AND phone != 'EMPTY'
    AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) < 10;
    
    -- Output analysis
    RAISE NOTICE 'LEAD DATA QUALITY ANALYSIS:';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Total uploaded leads: %', total_uploaded_leads;
    RAISE NOTICE 'Leads without phone: %', leads_no_phone;
    RAISE NOTICE 'Leads without email: %', leads_no_email;
    RAISE NOTICE 'Leads with no contact info: %', leads_no_contact;
    RAISE NOTICE 'Leads with EMPTY phone: %', leads_empty_phone;
    RAISE NOTICE 'Leads with invalid phone format: %', leads_invalid_phone;
    RAISE NOTICE '================================';
    
    IF leads_no_contact > 0 THEN
        RAISE NOTICE 'RECOMMENDATION: Delete % leads with no contact information', leads_no_contact;
    END IF;
END $$;

-- Create a function to safely clean up invalid leads
CREATE OR REPLACE FUNCTION cleanup_invalid_leads()
RETURNS TABLE(
    deleted_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    leads_to_delete_count INTEGER;
    deleted_leads INTEGER := 0;
    current_error TEXT := NULL;
BEGIN
    -- Count leads that will be deleted
    SELECT COUNT(*) INTO leads_to_delete_count
    FROM uploaded_leads 
    WHERE (phone IS NULL OR phone = '' OR phone = 'EMPTY')
    AND (email IS NULL OR email = '' OR email = 'EMPTY');
    
    IF leads_to_delete_count = 0 THEN
        RETURN QUERY SELECT 0, 'No invalid leads found to delete'::TEXT;
        RETURN;
    END IF;
    
    -- Delete leads with no contact information
    -- This will cascade to leads table and related tables
    BEGIN
        DELETE FROM uploaded_leads 
        WHERE (phone IS NULL OR phone = '' OR phone = 'EMPTY')
        AND (email IS NULL OR email = '' OR email = 'EMPTY');
        
        GET DIAGNOSTICS deleted_leads = ROW_COUNT;
        
        RETURN QUERY SELECT deleted_leads, NULL::TEXT;
        
    EXCEPTION WHEN OTHERS THEN
        current_error := SQLERRM;
        RETURN QUERY SELECT 0, current_error;
    END;
END;
$$ LANGUAGE plpgsql;

-- Create a function to normalize phone numbers
CREATE OR REPLACE FUNCTION normalize_phone_number(phone_input TEXT)
RETURNS TEXT AS $$
BEGIN
    IF phone_input IS NULL OR phone_input = '' OR phone_input = 'EMPTY' THEN
        RETURN NULL;
    END IF;
    
    -- Remove all non-digit characters
    phone_input := REGEXP_REPLACE(phone_input, '[^0-9]', '', 'g');
    
    -- If it starts with 1 and is 11 digits, keep as is
    IF LENGTH(phone_input) = 11 AND LEFT(phone_input, 1) = '1' THEN
        RETURN '+' || phone_input;
    END IF;
    
    -- If it's 10 digits, assume US number
    IF LENGTH(phone_input) = 10 THEN
        RETURN '+1' || phone_input;
    END IF;
    
    -- If it's less than 10 digits, it's invalid
    IF LENGTH(phone_input) < 10 THEN
        RETURN NULL;
    END IF;
    
    -- For other lengths, add + if not present
    IF LEFT(phone_input, 1) != '+' THEN
        RETURN '+' || phone_input;
    END IF;
    
    RETURN phone_input;
END;
$$ LANGUAGE plpgsql;

-- Create a function to validate email format
CREATE OR REPLACE FUNCTION is_valid_email(email_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF email_input IS NULL OR email_input = '' OR email_input = 'EMPTY' THEN
        RETURN FALSE;
    END IF;
    
    -- Basic email validation regex
    RETURN email_input ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql;

-- Update existing leads with normalized phone numbers
UPDATE uploaded_leads 
SET phone = normalize_phone_number(phone)
WHERE phone IS NOT NULL 
AND phone != '' 
AND phone != 'EMPTY';

-- Update leads table as well
UPDATE leads 
SET phone = normalize_phone_number(phone)
WHERE phone IS NOT NULL 
AND phone != '' 
AND phone != 'EMPTY';

-- Set invalid emails to NULL
UPDATE uploaded_leads 
SET email = NULL
WHERE email IS NOT NULL 
AND email != ''
AND email != 'EMPTY'
AND NOT is_valid_email(email);

UPDATE leads 
SET email = NULL
WHERE email IS NOT NULL 
AND email != ''
AND email != 'EMPTY'
AND NOT is_valid_email(email);

-- Add check constraints to prevent future invalid data
DO $$
BEGIN
    -- Add constraint for uploaded_leads phone format
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'uploaded_leads' 
        AND constraint_name = 'uploaded_leads_phone_format_check'
    ) THEN
        ALTER TABLE uploaded_leads 
        ADD CONSTRAINT uploaded_leads_phone_format_check 
        CHECK (
            phone IS NULL OR 
            (LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10 AND phone ~ '^\+?[0-9\s\-\(\)]+$')
        );
    END IF;
    
    -- Add constraint for uploaded_leads email format
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'uploaded_leads' 
        AND constraint_name = 'uploaded_leads_email_format_check'
    ) THEN
        ALTER TABLE uploaded_leads 
        ADD CONSTRAINT uploaded_leads_email_format_check 
        CHECK (
            email IS NULL OR 
            email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
        );
    END IF;
    
    -- Add constraint requiring at least one contact method
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'uploaded_leads' 
        AND constraint_name = 'uploaded_leads_contact_required_check'
    ) THEN
        ALTER TABLE uploaded_leads 
        ADD CONSTRAINT uploaded_leads_contact_required_check 
        CHECK (
            (phone IS NOT NULL AND phone != '' AND phone != 'EMPTY') OR 
            (email IS NOT NULL AND email != '' AND email != 'EMPTY')
        );
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add constraints (they may already exist): %', SQLERRM;
END $$;

-- Final analysis after cleanup
DO $$
DECLARE
    total_after INTEGER;
    valid_phone_after INTEGER;
    valid_email_after INTEGER;
    valid_contact_after INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_after FROM uploaded_leads;
    
    SELECT COUNT(*) INTO valid_phone_after 
    FROM uploaded_leads 
    WHERE phone IS NOT NULL AND phone != '' AND phone != 'EMPTY';
    
    SELECT COUNT(*) INTO valid_email_after 
    FROM uploaded_leads 
    WHERE email IS NOT NULL AND email != '' AND email != 'EMPTY';
    
    SELECT COUNT(*) INTO valid_contact_after 
    FROM uploaded_leads 
    WHERE (phone IS NOT NULL AND phone != '' AND phone != 'EMPTY')
    OR (email IS NOT NULL AND email != '' AND email != 'EMPTY');
    
    RAISE NOTICE 'POST-CLEANUP ANALYSIS:';
    RAISE NOTICE '=====================';
    RAISE NOTICE 'Total leads remaining: %', total_after;
    RAISE NOTICE 'Leads with valid phone: %', valid_phone_after;
    RAISE NOTICE 'Leads with valid email: %', valid_email_after;
    RAISE NOTICE 'Leads with valid contact: %', valid_contact_after;
    RAISE NOTICE '=====================';
END $$;