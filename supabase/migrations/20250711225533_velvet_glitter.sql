/*
  # Fix users table RLS policy for signup

  1. Security Changes
    - Update the INSERT policy for the users table to allow user creation during signup
    - The policy allows authenticated users to insert their own profile where the id matches auth.uid()
    - This resolves the "new row violates row-level security policy" error during registration

  2. Policy Details
    - Policy name: "Users can create own profile during signup"
    - Allows INSERT operations for authenticated users
    - Ensures users can only create profiles with their own auth.uid()
*/

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Users can manage own profile" ON users;

-- Create separate policies for different operations
CREATE POLICY "Users can create own profile during signup"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);