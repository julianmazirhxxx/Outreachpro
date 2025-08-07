import { createClient } from '@supabase/supabase-js'

// Production Supabase configuration
const supabaseUrl = 'https://zhlaaaysvzqixnugqbna.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpobGFhYXlzdnpxaXhudWdxYm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDYwOTUsImV4cCI6MjA2Njk4MjA5NX0.oS03M7cfw3JiQObDL5uwvTPc1F54awaOfdmqUBcIVTc'

// Debug logging for production
console.log('Supabase configuration:', {
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  supabaseUrl,
  supabaseKeyExists: !!supabaseAnonKey,
  configuredDirectly: true
})

// Create Supabase client with direct configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

console.log('✅ Supabase client created successfully with direct configuration')