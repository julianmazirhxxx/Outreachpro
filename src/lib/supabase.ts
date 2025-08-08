import { createClient } from '@supabase/supabase-js'

// Production Supabase configuration
const supabaseUrl = 'https://zhlaaaysvzqixnugqbna.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpobGFhYXlzdnpxaXhudWdxYm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDYwOTUsImV4cCI6MjA2Njk4MjA5NX0.oS03M7cfw3JiQObDL5uwvTPc1F54awaOfdmqUBcIVTc'

// Create Supabase client with direct configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'cold-outreach-saas'
    }
  }
});

// Test database connection on startup
supabase.from('users').select('count', { count: 'exact', head: true }).then(({ error }) => {
  if (error) {
    console.error('❌ Database connection test failed:', error);
  } else {
    console.log('✅ Database connection test successful');
  }
}).catch(err => {
  console.error('❌ Database connection test error:', err);
});