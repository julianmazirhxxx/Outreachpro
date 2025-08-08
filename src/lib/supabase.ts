import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zhlaaaysvzqixnugqbna.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpobGFhYXlzdnpxaXhudWdxYm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDYwOTUsImV4cCI6MjA2Njk4MjA5NX0.oS03M7cfw3JiQObDL5uwvTPc1F54awaOfdmqUBcIVTc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)