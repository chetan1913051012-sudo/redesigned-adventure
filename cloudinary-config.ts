// Cloudinary Configuration
// Sign up at https://cloudinary.com (FREE - 25GB storage)

export const cloudinaryConfig = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
}

export const isCloudinaryConfigured = (): boolean => {
  return !!(cloudinaryConfig.cloudName && cloudinaryConfig.uploadPreset)
}

// Upload file to Cloudinary
export const uploadToCloudinary = async (file: File): Promise<string> => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary not configured')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', cloudinaryConfig.uploadPreset)

  const resourceType = file.type.startsWith('video/') ? 'video' : 'image'

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`,
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
