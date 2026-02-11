import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl.length > 10 && 
    supabaseAnonKey.length > 10 &&
    supabaseUrl.includes('supabase.co')
  )
}

// Only create client if we have valid configuration
let supabase: SupabaseClient | null = null

if (isSupabaseConfigured()) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
}

export { supabase }
