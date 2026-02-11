import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase, isSupabaseConfigured } from './supabase-config'
import { loadCloudinarySettings, getCloudinaryConfig } from './cloudinary-config'
import MediaModal from './MediaModal'

interface Media {
  id: string
  title: string
  type: 'photo' | 'video'
  url: string
  description: string
  studentId: string
  status: 'pending' | 'approved' | 'rejected'
  uploadedBy: string
  createdAt: string
}

export default function StudentDashboard() {
  const { isStudentLoggedIn, currentStudent, logout } = useAuth()
  const navigate = useNavigate()
  const [media, setMedia] = useState<Media[]>([])
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all')
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Cloudinary state
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState(false)
  
  // Upload states
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  // Load Cloudinary settings from Supabase on mount
  useEffect(() => {
    const checkCloudinary = async () => {
      const config = await loadCloudinarySettings()
      setCloudinaryConfigured(!!(config?.cloudName && config?.uploadPreset))
    }
    checkCloudinary()
  }, [])

  useEffect(() => {
    if (!isStudentLoggedIn || !currentStudent) {
      navigate('/student/login')
      return
    }

    loadMedia()

    // Set up real-time subscription if Supabase is configured
    if (isSupabaseConfigured() && supabase) {
      const subscription = supabase
        .channel('media_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'media' }, () => {
          loadMedia()
        })
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [isStudentLoggedIn, currentStudent, navigate])

  const loadMedia = async () => {
    if (!currentStudent) return

    try {
      if (isSupabaseConfigured() && supabase) {
        // Fetch approved media assigned to this student OR to "all" students
        // Also fetch pending/rejected media uploaded by this student
        const { data, error } = await supabase
          .from('media')
          .select('*')
          .or(`and(student_id.eq.${currentStudent.studentId},status.eq.approved),and(student_id.eq.all,status.eq.approved),uploaded_by.eq.${currentStudent.studentId}`)
          .order('created_at', { ascending: false })

        if (error) throw error

        setMedia(data?.map(item => ({
          id: item.id,
          title: item.title,
          type: item.type,
          url: item.url,
          description: item.description || '',
          studentId: item.student_id,
          status: item.status || 'approved',
          uploadedBy: item.uploaded_by || 'admin',
          createdAt: item.created_at
        })) || [])
      } else {
        // localStorage fallback
        const storedMedia = localStorage.getItem('classX_media')
        if (storedMedia) {
          const allMedia: Media[] = JSON.parse(storedMedia)
          // Show approved media assigned to this student OR to "all" students
          // Also show pending/rejected media uploaded by this student
          setMedia(allMedia.filter(m => 
            (m.status === 'approved' && (m.studentId === currentStudent.studentId || m.studentId === 'all')) ||
            (m.uploadedBy === currentStudent.studentId)
          ))
        }
      }
    } catch (error) {
      console.error('Error loading media:', error)
      // Try simpler query as fallback
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data } = await supabase
            .from('media')
            .select('*')
            .order('created_at', { ascending: false })
          
          if (data) {
            const filteredData = data.filter(item => 
              (item.status === 'approved' && (item.student_id === currentStudent.studentId || item.student_id === 'all')) ||
              (item.uploaded_by === currentStudent.studentId)
            )
            setMedia(filteredData.map(item => ({
              id: item.id,
              title: item.title,
              type: item.type,
              url: item.url,
              description: item.description || '',
              studentId: item.student_id,
              status: item.status || 'approved',
              uploadedBy: item.uploaded_by || 'admin',
              createdAt: item.created_at
            })))
          }
        } catch (e) {
          console.error('Fallback query failed:', e)
        }
      }
    }

    setLoading(false)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const config = await getCloudinaryConfig()
    
    if (!config.cloudName || !config.uploadPreset) {
      throw new Error('Cloudinary not configured. Please ask admin to configure it.')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', config.uploadPreset)

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`,
      { method: 'POST', body: formData }
    )

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    const data = await response.json()
    return data.secure_url
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentStudent || uploadFiles.length === 0) return

    // Check if Cloudinary is configured
    if (!cloudinaryConfigured) {
      alert('⚠️ Cloud storage not configured. Please ask the admin to configure Cloudinary in the Settings tab.')
      return
    }

    setUploading(true)
    let successCount = 0
    let failCount = 0

    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i]
        setUploadProgress(`Uploading ${i + 1} of ${uploadFiles.length}...`)

        try {
          // Upload to Cloudinary
          const url = await uploadToCloudinary(file)

          const mediaType = file.type.startsWith('video/') ? 'video' : 'photo'
          const title = uploadFiles.length > 1 
            ? `${uploadTitle} (${i + 1})` 
            : uploadTitle

          const newMedia = {
            id: Date.now().toString() + i,
            title,
            type: mediaType,
            url,
            description: uploadDescription,
            studentId: currentStudent.studentId,
            studentName: currentStudent.name,
            status: 'pending', // Always pending for student uploads
            uploadedBy: currentStudent.studentId,
            createdAt: new Date().toISOString()
          }

          if (isSupabaseConfigured() && supabase) {
            const { error } = await supabase.from('media').insert({
              title: newMedia.title,
              type: newMedia.type,
              url: newMedia.url,
              description: newMedia.description,
              student_id: newMedia.studentId,
              student_name: newMedia.studentName,
              status: 'pending',
              uploaded_by: currentStudent.studentId,
              created_at: newMedia.createdAt
            })

            if (error) throw error
          } else {
            // localStorage fallback
            const stored = localStorage.getItem('classX_media')
            const allMedia = stored ? JSON.parse(stored) : []
            allMedia.unshift(newMedia)
            localStorage.setItem('classX_media', JSON.stringify(allMedia))
          }

          successCount++
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err)
          failCount++
        }
      }

      if (successCount > 0) {
        alert(`✅ ${successCount} file(s) uploaded successfully!\n\n⏳ Waiting for admin approval.`)
        setShowUploadModal(false)
        setUploadTitle('')
        setUploadDescription('')
        setUploadFiles([])
        loadMedia()
      }

      if (failCount > 0) {
        alert(`⚠️ ${failCount} file(s) failed to upload.`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed. Please try again.')
    }

    setUploading(false)
    setUploadProgress('')
  }

  const filteredMedia = media.filter(m => {
    if (filter === 'all') return true
    return m.type === filter
  })

  // Separate approved and pending media
  const approvedMedia = filteredMedia.filter(m => m.status === 'approved')
  const myPendingMedia = filteredMedia.filter(m => m.uploadedBy === currentStudent?.studentId && m.status === 'pending')
  const myRejectedMedia = filteredMedia.filter(m => m.uploadedBy === currentStudent?.studentId && m.status === 'rejected')

  if (!isStudentLoggedIn || !currentStudent) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-blue-600">
                {currentStudent.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{currentStudent.name}</h1>
              <p className="text-sm text-gray-500">
                {currentStudent.class} {currentStudent.section} • Roll No: {currentStudent.rollNo}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUploadModal(true)}
              disabled={!cloudinaryConfigured}
              className={`px-4 py-2 rounded-lg transition font-medium ${
                cloudinaryConfigured
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              📤 Upload Media
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Mode Banner */}
      <div className={`text-center py-2 text-sm ${isSupabaseConfigured() ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
        {isSupabaseConfigured() 
          ? `🟢 Connected ${cloudinaryConfigured ? '+ Cloud Storage Ready' : '- ⚠️ Cloud storage not configured (contact admin)'}` 
          : '🟡 Local Mode - Data stored in browser only'}
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-3xl font-bold text-blue-600">{approvedMedia.length}</p>
            <p className="text-gray-500">Approved Media</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-3xl font-bold text-yellow-600">{myPendingMedia.length}</p>
            <p className="text-gray-500">Pending Approval</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-3xl font-bold text-green-600">{approvedMedia.filter(m => m.type === 'photo').length}</p>
            <p className="text-gray-500">Photos</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-3xl font-bold text-purple-600">{approvedMedia.filter(m => m.type === 'video').length}</p>
            <p className="text-gray-500">Videos</p>
          </div>
        </div>

        {/* Warning if Cloudinary not configured */}
        {!cloudinaryConfigured && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-orange-800 font-medium">⚠️ Cloud storage not configured</p>
            <p className="text-orange-700 text-sm mt-1">
              Please ask your admin to configure Cloudinary in the Settings tab to enable file uploads.
            </p>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          {['all', 'photo', 'video'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type as 'all' | 'photo' | 'video')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}s
            </button>
          ))}
        </div>

        {/* My Pending Uploads */}
        {myPendingMedia.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-yellow-700 mb-4">⏳ Your Pending Uploads (Waiting for Admin Approval)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {myPendingMedia.map((item) => (
                <div
                  key={item.id}
                  className="bg-yellow-50 border-2 border-yellow-300 rounded-xl overflow-hidden shadow-sm"
                >
                  <div className="aspect-video relative overflow-hidden bg-gray-100">
                    {item.type === 'photo' ? (
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover opacity-75" />
                    ) : (
                      <video src={item.url} className="w-full h-full object-cover opacity-75" />
                    )}
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-400 text-yellow-900">
                        ⏳ Pending
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-gray-800 truncate">{item.title}</h3>
                    <p className="text-xs text-yellow-600 mt-1">Waiting for admin approval</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejected Uploads */}
        {myRejectedMedia.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-red-700 mb-4">❌ Rejected Uploads</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {myRejectedMedia.map((item) => (
                <div
                  key={item.id}
                  className="bg-red-50 border-2 border-red-300 rounded-xl overflow-hidden shadow-sm"
                >
                  <div className="aspect-video relative overflow-hidden bg-gray-100">
                    {item.type === 'photo' ? (
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover opacity-50" />
                    ) : (
                      <video src={item.url} className="w-full h-full object-cover opacity-50" />
                    )}
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-400 text-white">
                        ❌ Rejected
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-gray-800 truncate">{item.title}</h3>
                    <p className="text-xs text-red-600 mt-1">This upload was not approved</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approved Media Grid */}
        <h2 className="text-lg font-bold text-gray-800 mb-4">✅ Your Media</h2>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading your media...</p>
          </div>
        ) : approvedMedia.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500">No approved media yet</p>
            <p className="text-sm text-gray-400 mt-1">Upload photos/videos or wait for admin to share with you!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {approvedMedia.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedMedia(item)}
                className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition cursor-pointer group"
              >
                <div className="aspect-video relative overflow-hidden bg-gray-100">
                  {item.type === 'photo' ? (
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                      <video src={item.url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.type === 'photo' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {item.type}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-gray-800 truncate">{item.title}</h3>
                  {item.studentId === 'all' && (
                    <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full mt-1">
                      🌐 Class Photo
                    </span>
                  )}
                  {item.description && (
                    <p className="text-sm text-gray-500 truncate mt-1">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">📤 Upload Media for Approval</h2>
            
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                ⚠️ Your uploads will be reviewed by admin before they become visible.
              </p>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="My Photo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Files *</label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {uploadFiles.length > 0 && (
                    <p className="text-sm text-green-600 mt-1">
                      ✅ {uploadFiles.length} file(s) selected
                    </p>
                  )}
                </div>
              </div>

              {uploadProgress && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">{uploadProgress}</p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false)
                    setUploadTitle('')
                    setUploadDescription('')
                    setUploadFiles([])
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || uploadFiles.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : `Upload for Approval`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Modal */}
      {selectedMedia && (
        <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
      )}
    </div>
  )
}
