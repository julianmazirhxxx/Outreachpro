/*
  # Add email and password fields to users table

  1. Changes to users table
    - Add `email` column (unique, required)
    - Add `password` column (required, will store hashed passwords)
    - Add unique constraint on email
    - Update existing records to have placeholder data

  2. Security
    - Email must be unique
    - Password will be hashed before storage
*/

-- Add email and password columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS password text;

-- Add unique constraint on email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_email_unique' 
    AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- Make email and password required (not null)
ALTER TABLE users 
ALTER COLUMN email SET NOT NULL,
ALTER COLUMN password SET NOT NULL;

-- Update existing users with placeholder data (you may want to handle this differently)
UPDATE users 
SET email = COALESCE(email, 'user' || id::text || '@placeholder.com'),
    password = COALESCE(password, 'placeholder_password_hash')
WHERE email IS NULL OR password IS NULL;