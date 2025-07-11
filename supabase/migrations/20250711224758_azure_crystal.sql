/*
  # Fix membership RLS policy for user registration

  1. Security Changes
    - Update RLS policy on `memberships` table to allow INSERT operations
    - Ensure users can create their own membership record during registration
    - Maintain security by restricting users to only manage their own records

  This migration fixes the RLS policy violation that prevents new user registration.
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage own membership" ON memberships;

-- Create new policy that allows INSERT, SELECT, UPDATE for own records
CREATE POLICY "Users can manage own membership"
  ON memberships
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;