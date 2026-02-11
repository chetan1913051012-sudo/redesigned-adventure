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

// Cloudinary settings cache
let cloudinaryCache: { cloudName: string; uploadPreset: string } | null = null

export const loadCloudinarySettings = async (): Promise<{ cloudName: string; uploadPreset: string } | null> => {
  // Return cache if available
  if (cloudinaryCache) return cloudinaryCache
  
  // Try to load from Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'cloudinary')
        .single()
      
      if (data && !error) {
        cloudinaryCache = {
          cloudName: data.cloud_name || '',
          uploadPreset: data.upload_preset || ''
        }
        return cloudinaryCache
      }
    } catch (e) {
      console.log('Settings table may not exist yet')
    }
  }
  
  // Fallback to localStorage
  const cloudName = localStorage.getItem('cloudinary_cloud_name')
  const uploadPreset = localStorage.getItem('cloudinary_upload_preset')
  if (cloudName && uploadPreset) {
    cloudinaryCache = { cloudName, uploadPreset }
    return cloudinaryCache
  }
  
  return null
}

export const saveCloudinarySettings = async (cloudName: string, uploadPreset: string): Promise<boolean> => {
  // Save to Supabase
  if (supabase) {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ 
          key: 'cloudinary', 
          cloud_name: cloudName, 
          upload_preset: uploadPreset,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' })
      
      if (!error) {
        cloudinaryCache = { cloudName, uploadPreset }
        // Also save to localStorage as backup
        localStorage.setItem('cloudinary_cloud_name', cloudName)
        localStorage.setItem('cloudinary_upload_preset', uploadPreset)
        return true
      }
    } catch (e) {
      console.log('Error saving to Supabase, using localStorage')
    }
  }
  
  // Fallback to localStorage
  localStorage.setItem('cloudinary_cloud_name', cloudName)
  localStorage.setItem('cloudinary_upload_preset', uploadPreset)
  cloudinaryCache = { cloudName, uploadPreset }
  return true
}

export const getCloudinaryConfig = async (): Promise<{ cloudName: string; uploadPreset: string }> => {
  const config = await loadCloudinarySettings()
  return config || { cloudName: '', uploadPreset: '' }
}
