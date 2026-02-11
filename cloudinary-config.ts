// Cloudinary Configuration
// Sign up at https://cloudinary.com (FREE - 25GB storage)

import { supabase, isSupabaseConfigured } from './supabase-config'

// Local cache for Cloudinary config
let cachedConfig: { cloudName: string; uploadPreset: string } | null = null

// Get config from localStorage (backup)
const getLocalConfig = () => {
  if (typeof window !== 'undefined') {
    const cloudName = localStorage.getItem('cloudinary_cloud_name')
    const uploadPreset = localStorage.getItem('cloudinary_upload_preset')
    if (cloudName && uploadPreset) {
      return { cloudName, uploadPreset }
    }
  }
  return null
}

// Load Cloudinary settings from Supabase
export const loadCloudinarySettings = async (): Promise<{ cloudName: string; uploadPreset: string } | null> => {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig
  }

  console.log('Loading Cloudinary settings...')
  console.log('Supabase configured:', isSupabaseConfigured())

  // Try loading from Supabase first
  if (isSupabaseConfigured() && supabase) {
    try {
      console.log('Fetching from Supabase settings table...')
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'cloudinary')
        .maybeSingle()

      console.log('Supabase response - data:', data, 'error:', error)

      if (!error && data && data.cloud_name && data.upload_preset) {
        cachedConfig = {
          cloudName: data.cloud_name,
          uploadPreset: data.upload_preset
        }
        // Also save to localStorage as backup
        localStorage.setItem('cloudinary_cloud_name', data.cloud_name)
        localStorage.setItem('cloudinary_upload_preset', data.upload_preset)
        console.log('✅ Cloudinary settings loaded from Supabase')
        return cachedConfig
      }
    } catch (err) {
      console.error('Error loading from Supabase:', err)
    }
  }

  // Fallback to localStorage
  const localConfig = getLocalConfig()
  if (localConfig) {
    cachedConfig = localConfig
    return cachedConfig
  }

  // Fallback to env variables
  const envCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const envUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (envCloudName && envUploadPreset) {
    cachedConfig = { cloudName: envCloudName, uploadPreset: envUploadPreset }
    return cachedConfig
  }

  return null
}

// Save Cloudinary settings to Supabase (permanent) and localStorage (backup)
export const saveCloudinarySettings = async (cloudName: string, uploadPreset: string): Promise<{ success: boolean; message: string }> => {
  console.log('=== Saving Cloudinary Settings ===')
  console.log('Cloud Name:', cloudName)
  console.log('Upload Preset:', uploadPreset)
  console.log('Supabase configured:', isSupabaseConfigured())
  console.log('Supabase client exists:', !!supabase)

  // Update cache
  cachedConfig = { cloudName, uploadPreset }

  // Save to localStorage as backup
  localStorage.setItem('cloudinary_cloud_name', cloudName)
  localStorage.setItem('cloudinary_upload_preset', uploadPreset)

  // Save to Supabase for permanent storage across all devices
  if (isSupabaseConfigured() && supabase) {
    try {
      console.log('Step 1: Deleting existing settings...')
      const deleteResult = await supabase.from('settings').delete().eq('key', 'cloudinary')
      console.log('Delete result:', deleteResult)

      console.log('Step 2: Inserting new settings...')
      const { data, error } = await supabase
        .from('settings')
        .insert({
          key: 'cloudinary',
          cloud_name: cloudName,
          upload_preset: uploadPreset,
          updated_at: new Date().toISOString()
        })
        .select()

      console.log('Insert result - data:', data, 'error:', error)

      if (error) {
        console.error('❌ Supabase Error:', error.message)
        return { 
          success: false, 
          message: `Database Error: ${error.message}. Settings saved locally only.` 
        }
      }

      console.log('✅ Settings saved to Supabase successfully!')
      return { 
        success: true, 
        message: '✅ Settings saved permanently to database!' 
      }
    } catch (err: any) {
      console.error('❌ Exception:', err)
      return { 
        success: false, 
        message: `Error: ${err.message}. Settings saved locally only.` 
      }
    }
  } else {
    console.log('⚠️ Supabase not configured, saved to localStorage only')
    return { 
      success: false, 
      message: '⚠️ Supabase not connected. Settings saved locally only (will reset on other devices).' 
    }
  }
}

// Check if Cloudinary is configured
export const isCloudinaryConfigured = (): boolean => {
  if (cachedConfig && cachedConfig.cloudName && cachedConfig.uploadPreset) {
    return true
  }
  const localConfig = getLocalConfig()
  return !!(localConfig?.cloudName && localConfig?.uploadPreset)
}

// Check if Cloudinary is configured (async version - checks Supabase)
export const checkCloudinaryConfigured = async (): Promise<boolean> => {
  const config = await loadCloudinarySettings()
  return !!(config?.cloudName && config?.uploadPreset)
}

// Get Cloudinary config (sync - uses cache/localStorage)
export const getCloudinaryConfig = () => {
  if (cachedConfig) {
    return cachedConfig
  }
  const localConfig = getLocalConfig()
  if (localConfig) {
    return localConfig
  }
  return {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
    uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
  }
}

// Clear cached config (force reload from Supabase)
export const clearCloudinaryCache = () => {
  cachedConfig = null
}

// Legacy export for backwards compatibility
export const saveCloudinaryConfig = saveCloudinarySettings
export const cloudinaryConfig = getCloudinaryConfig()

// Upload file to Cloudinary
export const uploadToCloudinary = async (file: File): Promise<string> => {
  // Try to load config from Supabase first
  let config = await loadCloudinarySettings()

  if (!config || !config.cloudName || !config.uploadPreset) {
    throw new Error('Cloudinary not configured. Please ask admin to configure Cloudinary in Settings.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', config.uploadPreset)

  const resourceType = file.type.startsWith('video/') ? 'video' : 'image'

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Upload failed')
  }

  const data = await response.json()
  return data.secure_url
}
