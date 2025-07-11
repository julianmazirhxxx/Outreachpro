/*
  # Fix memberships table RLS policy for user registration

  1. Security Changes
    - Drop existing restrictive RLS policy on memberships table
    - Add new policy allowing authenticated users to insert their own membership records
    - Add policy allowing users to read their own membership data
    - Add policy allowing users to update their own membership data

  This resolves the "new row violates row-level security policy" error during user signup.
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage own membership" ON memberships;

-- Create new policies that allow proper user registration
CREATE POLICY "Users can insert own membership"
  ON memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own membership"
  ON memberships
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own membership"
  ON memberships
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);