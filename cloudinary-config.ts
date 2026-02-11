// Cloudinary Configuration
// Sign up at https://cloudinary.com (FREE - 25GB storage)

// Get config from localStorage (for web preview) or env variables
const getStoredConfig = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('cloudinary_config')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return null
      }
    }
  }
  return null
}

export const getCloudinaryConfig = () => {
  const stored = getStoredConfig()
  return {
    cloudName: stored?.cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
    uploadPreset: stored?.uploadPreset || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
  }
}

export const cloudinaryConfig = getCloudinaryConfig()

export const isCloudinaryConfigured = (): boolean => {
  const config = getCloudinaryConfig()
  return !!(config.cloudName && config.uploadPreset)
}

export const saveCloudinaryConfig = (cloudName: string, uploadPreset: string) => {
  localStorage.setItem('cloudinary_config', JSON.stringify({ cloudName, uploadPreset }))
}

// Upload file to Cloudinary
export const uploadToCloudinary = async (file: File): Promise<string> => {
  const config = getCloudinaryConfig()
  
  if (!config.cloudName || !config.uploadPreset) {
    throw new Error('Cloudinary not configured')
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
