import { createClient } from '@supabase/supabase-js'

// Get environment variables with fallbacks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

// Debug logging for production
console.log('Environment check:', {
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  supabaseUrlExists: !!supabaseUrl,
  supabaseKeyExists: !!supabaseAnonKey,
  supabaseUrlValue: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined',
  allEnvKeys: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
})

let supabase: any;

if (!supabaseUrl || !supabaseAnonKey || 
    supabaseUrl === 'undefined' || supabaseAnonKey === 'undefined' ||
    supabaseUrl === '' || supabaseAnonKey === '') {
  console.error('❌ Supabase environment variables not properly configured')
  console.error('VITE_SUPABASE_URL:', supabaseUrl || 'MISSING/EMPTY')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'MISSING/EMPTY')
  console.error('Available env vars:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')))
  console.error('Please verify environment variables are set correctly in Netlify dashboard')
  
  // Create a mock client for demo mode
  supabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.reject(new Error('Supabase not configured')),
      signUp: () => Promise.reject(new Error('Supabase not configured')),
      signOut: () => Promise.resolve({ error: null })
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) })
    })
  };
} else {
  console.log('Supabase configured successfully for production')
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };