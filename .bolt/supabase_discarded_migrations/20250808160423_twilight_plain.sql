/*
  # Create Lists Infrastructure

  1. New Tables
    - `lists` - Independent lead collections (separate from campaigns)
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `name` (text, list name)
      - `description` (text, optional description)
      - `tags` (text array, for categorization)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `list_leads` - Leads within lists (separate from campaign leads)
      - `id` (uuid, primary key)
      - `list_id` (uuid, references lists)
      - `user_id` (uuid, references users)
      - `name` (text, lead name)
      - `email` (text, optional)
      - `phone` (text, optional)
      - `company_name` (text, optional)
      - `job_title` (text, optional)
      - `source_url` (text, optional)
      - `source_platform` (text, optional)
      - `custom_fields` (jsonb, for additional data)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage their own lists and leads

  3. Indexes
    - Performance indexes for common queries
    - Unique constraints to prevent duplicates within lists