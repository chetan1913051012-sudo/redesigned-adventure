import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase, isSupabaseConfigured, loadCloudinarySettings, saveCloudinarySettings, getCloudinaryConfig } from './supabase-config'

interface Student {
  id: string
  studentId: string
  password: string
  name: string
  rollNo: string
  class: string
  section: string
  email: string
  phone: string
}

interface Media {
  id: string
  title: string
  type: 'photo' | 'video'
  url: string
  description: string
  studentId: string
  studentName?: string
  status: 'pending' | 'approved' | 'rejected'
  uploadedBy: string
  createdAt: string
}

const uploadToCloudinary = async (file: File): Promise<string> => {
  const config = await getCloudinaryConfig()
  
  if (!config.cloudName || !config.uploadPreset) {
    throw new Error('Cloudinary not configured')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', config.uploadPreset)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`,
    { method: 'POST', body: formData }
  )

  if (!response.ok) {
    throw new Error('Cloudinary upload failed')
  }

  const data = await response.json()
  return data.secure_url
}

export default function AdminDashboard() {
  const { isAdminLoggedIn, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'students' | 'media' | 'approvals' | 'settings'>('students')
  const [students, setStudents] = useState<Student[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [showStudentForm, setShowStudentForm] = useState(false)
  const [showMediaForm, setShowMediaForm] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  // Cloudinary popup state
  const [showCloudinaryPopup, setShowCloudinaryPopup] = useState(false)
  const [cloudinaryLoading, setCloudinaryLoading] = useState(true)

  // Student form state
  const [studentForm, setStudentForm] = useState({
    studentId: '',
    password: '',
    name: '',
    rollNo: '',
    class: 'X',
    section: 'A',
    email: '',
    phone: ''
  })

  // Media form state
  const [mediaForm, setMediaForm] = useState({
    title: '',
    description: '',
    studentId: '',
    files: [] as File[]
  })
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null)

  // Settings state
  const [cloudinaryForm, setCloudinaryForm] = useState({
    cloudName: '',
    uploadPreset: ''
  })
  const [cloudinaryConnected, setCloudinaryConnected] = useState(false)

  // Load Cloudinary settings from Supabase on mount
  useEffect(() => {
    const loadSettings = async () => {
      setCloudinaryLoading(true)
      const config = await loadCloudinarySettings()
      if (config && config.cloudName && config.uploadPreset) {
        setCloudinaryForm({
          cloudName: config.cloudName,
          uploadPreset: config.uploadPreset
        })
        setCloudinaryConnected(true)
      } else {
        // Show popup if not configured
        if (isAdminLoggedIn) {
          setShowCloudinaryPopup(true)
        }
      }
      setCloudinaryLoading(false)
    }
    loadSettings()
  }, [isAdminLoggedIn])

  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigate('/admin/login')
      return
    }

    loadData()

    // Set up real-time subscriptions if Supabase is configured
    if (isSupabaseConfigured() && supabase) {
      const studentsSubscription = supabase
        .channel('students_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
          loadStudents()
        })
        .subscribe()

      const mediaSubscription = supabase
        .channel('media_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'media' }, () => {
          loadMedia()
        })
        .subscribe()

      return () => {
        studentsSubscription.unsubscribe()
        mediaSubscription.unsubscribe()
      }
    }
  }, [isAdminLoggedIn, navigate])

  const loadData = async () => {
    await Promise.all([loadStudents(), loadMedia()])
    setLoading(false)
  }

  const loadStudents = async () => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        setStudents(data?.map(s => ({
          id: s.id,
          studentId: s.student_id,
          password: s.password,
          name: s.name,
          rollNo: s.roll_no || '',
          class: s.class || '',
          section: s.section || '',
          email: s.email || '',
          phone: s.phone || ''
        })) || [])
      } else {
        const stored = localStorage.getItem('classX_students')
        if (stored) setStudents(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error loading students:', error)
    }
  }

  const loadMedia = async () => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('media')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        setMedia(data?.map(m => ({
          id: m.id,
          title: m.title,
          type: m.type,
          url: m.url,
          description: m.description || '',
          studentId: m.student_id,
          studentName: m.student_name,
          status: m.status || 'approved',
          uploadedBy: m.uploaded_by || 'admin',
          createdAt: m.created_at
        })) || [])
      } else {
        const stored = localStorage.getItem('classX_media')
        if (stored) {
          const parsed = JSON.parse(stored)
          setMedia(parsed.map((m: Media) => ({
            ...m,
            status: m.status || 'approved',
            uploadedBy: m.uploadedBy || 'admin'
          })))
        }
      }
    } catch (error) {
      console.error('Error loading media:', error)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (isSupabaseConfigured() && supabase) {
        if (editingStudent) {
          const { error } = await supabase
            .from('students')
            .update({
              student_id: studentForm.studentId,
              password: studentForm.password,
              name: studentForm.name,
              roll_no: studentForm.rollNo,
              class: studentForm.class,
              section: studentForm.section,
              email: studentForm.email,
              phone: studentForm.phone
            })
            .eq('id', editingStudent.id)

          if (error) throw error
        } else {
          const { error } = await supabase
            .from('students')
            .insert({
              student_id: studentForm.studentId,
              password: studentForm.password,
              name: studentForm.name,
              roll_no: studentForm.rollNo,
              class: studentForm.class,
              section: studentForm.section,
              email: studentForm.email,
              phone: studentForm.phone
            })

          if (error) throw error
        }
      } else {
        // localStorage fallback
        if (editingStudent) {
          const updated = students.map(s => 
            s.id === editingStudent.id 
              ? { ...studentForm, id: editingStudent.id }
              : s
          )
          setStudents(updated)
          localStorage.setItem('classX_students', JSON.stringify(updated))
        } else {
          const newStudent = { ...studentForm, id: Date.now().toString() }
          const updated = [...students, newStudent]
          setStudents(updated)
          localStorage.setItem('classX_students', JSON.stringify(updated))
        }
      }

      resetStudentForm()
      loadStudents()
    } catch (error) {
      console.error('Error saving student:', error)
      alert('Error saving student. Please try again.')
    }
  }

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('students').delete().eq('id', id)
        if (error) throw error
      } else {
        const updated = students.filter(s => s.id !== id)
        setStudents(updated)
        localStorage.setItem('classX_students', JSON.stringify(updated))
      }
      loadStudents()
    } catch (error) {
      console.error('Error deleting student:', error)
    }
  }

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student)
    setStudentForm({
      studentId: student.studentId,
      password: student.password,
      name: student.name,
      rollNo: student.rollNo,
      class: student.class,
      section: student.section,
      email: student.email,
      phone: student.phone
    })
    setShowStudentForm(true)
  }

  const resetStudentForm = () => {
    setStudentForm({
      studentId: '',
      password: '',
      name: '',
      rollNo: '',
      class: 'X',
      section: 'A',
      email: '',
      phone: ''
    })
    setEditingStudent(null)
    setShowStudentForm(false)
  }

  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB limit

  const handleMediaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mediaForm.files.length === 0 || !mediaForm.studentId) {
      alert('Please select at least one file and a student')
      return
    }

    // Check if Cloudinary is configured
    if (!cloudinaryConnected) {
      alert('⚠️ Please configure Cloudinary first in the Settings tab to enable file uploads.')
      setActiveTab('settings')
      return
    }

    // Check file sizes
    const oversizedFiles = mediaForm.files.filter(f => f.size > MAX_FILE_SIZE)
    if (oversizedFiles.length > 0) {
      alert(`❌ These files are too large (max 100MB each):\n\n${oversizedFiles.map(f => `• ${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`).join('\n')}\n\nPlease compress the videos or choose smaller files.`)
      return
    }

    const isAllStudents = mediaForm.studentId === 'all'
    const selectedStudent = isAllStudents ? null : students.find(s => s.studentId === mediaForm.studentId)
    const studentName = isAllStudents ? 'All Students' : (selectedStudent?.name || '')

    setUploadProgress({ current: 0, total: mediaForm.files.length })

    const failedFiles: string[] = []
    let successCount = 0

    for (let i = 0; i < mediaForm.files.length; i++) {
      const file = mediaForm.files[i]
      const mediaType = file.type.startsWith('video/') ? 'video' : 'photo'
      const fileTitle = mediaForm.files.length === 1 
        ? mediaForm.title 
        : `${mediaForm.title} (${i + 1})`

      setUploadProgress({ current: i + 1, total: mediaForm.files.length })

      try {
        let fileUrl = ''

        // Upload to Cloudinary (25GB FREE storage!)
        try {
          fileUrl = await uploadToCloudinary(file)
        } catch (cloudinaryError) {
          console.error('Cloudinary upload failed:', cloudinaryError)
          throw cloudinaryError
        }

        // Save media record to database - admin uploads are auto-approved
        if (isSupabaseConfigured() && supabase) {
          const { error } = await supabase.from('media').insert({
            title: fileTitle,
            type: mediaType,
            url: fileUrl,
            description: mediaForm.description,
            student_id: mediaForm.studentId,
            student_name: studentName,
            status: 'approved', // Admin uploads are auto-approved
            uploaded_by: 'admin'
          })

          if (error) {
            console.error('Database error:', error)
            failedFiles.push(`${file.name}: ${error.message}`)
            continue
          }
        } else {
          // localStorage fallback
          const newMedia: Media = {
            id: `${Date.now()}_${i}`,
            title: fileTitle,
            type: mediaType,
            url: fileUrl,
            description: mediaForm.description,
            studentId: mediaForm.studentId,
            studentName: studentName,
            status: 'approved',
            uploadedBy: 'admin',
            createdAt: new Date().toISOString()
          }
          const stored = localStorage.getItem('classX_media')
          const existing = stored ? JSON.parse(stored) : []
          const updated = [...existing, newMedia]
          localStorage.setItem('classX_media', JSON.stringify(updated))
        }
        
        successCount++
      } catch (error: unknown) {
        console.error('Error uploading file:', file.name, error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        failedFiles.push(`${file.name}: ${errorMessage}`)
      }
    }

    setMediaForm({ title: '', description: '', studentId: '', files: [] })
    setShowMediaForm(false)
    setUploadProgress(null)
    loadMedia()

    // Show result message
    if (failedFiles.length === 0) {
      alert(`✅ Successfully uploaded ${successCount} file(s)!`)
    } else if (successCount > 0) {
      alert(`⚠️ Uploaded ${successCount} file(s), but ${failedFiles.length} failed:\n\n${failedFiles.join('\n')}`)
    } else {
      alert(`❌ All uploads failed:\n\n${failedFiles.join('\n')}\n\nPossible reasons:\n• File too large (max 100MB)\n• Cloudinary not set up correctly\n• Network issue`)
    }
  }

  const handleDeleteMedia = async (id: string) => {
    if (!confirm('Are you sure you want to delete this media?')) return

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('media').delete().eq('id', id)
        if (error) throw error
      } else {
        const updated = media.filter(m => m.id !== id)
        setMedia(updated)
        localStorage.setItem('classX_media', JSON.stringify(updated))
      }
      loadMedia()
    } catch (error) {
      console.error('Error deleting media:', error)
    }
  }

  // Approve/Reject media
  const handleApproveMedia = async (id: string) => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('media')
          .update({ status: 'approved' })
          .eq('id', id)
        if (error) throw error
      } else {
        const updated = media.map(m => 
          m.id === id ? { ...m, status: 'approved' as const } : m
        )
        setMedia(updated)
        localStorage.setItem('classX_media', JSON.stringify(updated))
      }
      loadMedia()
      alert('✅ Media approved!')
    } catch (error) {
      console.error('Error approving media:', error)
      alert('Failed to approve media')
    }
  }

  const handleRejectMedia = async (id: string) => {
    if (!confirm('Are you sure you want to reject this upload?')) return

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('media')
          .update({ status: 'rejected' })
          .eq('id', id)
        if (error) throw error
      } else {
        const updated = media.map(m => 
          m.id === id ? { ...m, status: 'rejected' as const } : m
        )
        setMedia(updated)
        localStorage.setItem('classX_media', JSON.stringify(updated))
      }
      loadMedia()
      alert('❌ Media rejected!')
    } catch (error) {
      console.error('Error rejecting media:', error)
      alert('Failed to reject media')
    }
  }

  // Save cloudinary settings to Supabase (permanent!)
  const handleSaveCloudinary = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!cloudinaryForm.cloudName || !cloudinaryForm.uploadPreset) {
      alert('Please enter both Cloud Name and Upload Preset')
      return
    }

    const success = await saveCloudinarySettings(cloudinaryForm.cloudName, cloudinaryForm.uploadPreset)
    if (success) {
      setCloudinaryConnected(true)
      setShowCloudinaryPopup(false)
      alert('✅ Cloudinary settings saved permanently! Files will now upload to cloud storage (25GB FREE).')
    } else {
      alert('❌ Failed to save settings. Please try again.')
    }
  }

  // Disconnect Cloudinary
  const handleDisconnectCloudinary = async () => {
    if (!confirm('Are you sure you want to disconnect Cloudinary?')) return

    // Clear from Supabase
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('settings').delete().eq('key', 'cloudinary')
    }
    
    // Clear from localStorage
    localStorage.removeItem('cloudinary_cloud_name')
    localStorage.removeItem('cloudinary_upload_preset')
    
    setCloudinaryForm({ cloudName: '', uploadPreset: '' })
    setCloudinaryConnected(false)
  }

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.rollNo.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Get pending uploads
  const pendingMedia = media.filter(m => m.status === 'pending')
  const approvedMedia = media.filter(m => m.status === 'approved')

  if (!isAdminLoggedIn) return null

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
              <p className="text-sm text-gray-500">Manage students and media</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-medium"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Mode Banner */}
      <div className={`text-center py-2 text-sm ${isSupabaseConfigured() ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
        {isSupabaseConfigured() 
          ? `🟢 Supabase Connected ${cloudinaryConnected ? '+ Cloudinary (25GB Storage)' : ''} - Real-time sync enabled` 
          : '🟡 Local Mode - Data stored in browser only. Configure Supabase + Cloudinary for real-time sync.'}
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-6 py-3 font-medium transition whitespace-nowrap ${
              activeTab === 'students'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            👥 Students ({students.length})
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-6 py-3 font-medium transition whitespace-nowrap ${
              activeTab === 'media'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📷 Media ({approvedMedia.length})
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-6 py-3 font-medium transition whitespace-nowrap ${
              activeTab === 'approvals'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ⏳ Approvals {pendingMedia.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {pendingMedia.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 font-medium transition whitespace-nowrap ${
              activeTab === 'settings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚙️ Settings {cloudinaryConnected ? '✅' : '⚠️'}
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading || cloudinaryLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading...</p>
          </div>
        ) : activeTab === 'students' ? (
          <div>
            {/* Students Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
              <input
                type="text"
                placeholder="Search by name, ID or roll no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => setShowStudentForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                + Add Student
              </button>
            </div>

            {/* Students Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Student ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Password</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Roll No</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Class</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Section</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Phone</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                          No students found. Click "Add Student" to add one.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-blue-600">{student.studentId}</td>
                          <td className="px-4 py-3 font-mono text-sm bg-gray-50">{student.password}</td>
                          <td className="px-4 py-3">{student.name}</td>
                          <td className="px-4 py-3">{student.rollNo}</td>
                          <td className="px-4 py-3">{student.class}</td>
                          <td className="px-4 py-3">{student.section}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{student.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{student.phone}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditStudent(student)}
                                className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student.id)}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'media' ? (
          <div>
            {/* Media Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">📷 Approved Media</h2>
                <p className="text-sm text-gray-500">Upload photos and videos for students</p>
              </div>
              <button
                onClick={() => setShowMediaForm(true)}
                disabled={students.length === 0 || !cloudinaryConnected}
                className={`px-4 py-2 rounded-lg transition font-medium ${
                  students.length === 0 || !cloudinaryConnected
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                + Upload Media
              </button>
            </div>

            {/* Warning if no students */}
            {students.length === 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 font-medium">⚠️ No students added yet!</p>
                <p className="text-yellow-700 text-sm mt-1">
                  You need to add students first before uploading media.
                </p>
              </div>
            )}

            {/* Warning if Cloudinary not configured */}
            {!cloudinaryConnected && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-orange-800 font-medium">⚠️ Cloudinary not configured!</p>
                <p className="text-orange-700 text-sm mt-1">
                  Go to <button onClick={() => setActiveTab('settings')} className="underline font-medium">Settings</button> to configure cloud storage for file uploads.
                </p>
              </div>
            )}

            {/* Media Grid */}
            {approvedMedia.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                <div className="text-6xl mb-4">📷</div>
                <p className="text-gray-500 text-lg">No approved media yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {approvedMedia.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl overflow-hidden shadow-sm">
                    <div className="aspect-video relative overflow-hidden bg-gray-100">
                      {item.type === 'photo' ? (
                        <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <video src={item.url} className="w-full h-full object-cover" />
                      )}
                      <span className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
                        item.type === 'photo' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-gray-800">{item.title}</h3>
                      {item.studentId === 'all' ? (
                        <p className="text-sm text-green-600 font-medium">🌐 All Students</p>
                      ) : (
                        <p className="text-sm text-blue-600">📌 {item.studentName || item.studentId}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        By: {item.uploadedBy === 'admin' ? '👨‍💼 Admin' : `👤 ${item.uploadedBy}`}
                      </p>
                      <button
                        onClick={() => handleDeleteMedia(item.id)}
                        className="mt-2 w-full px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'approvals' ? (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800">⏳ Pending Approvals</h2>
              <p className="text-sm text-gray-500">Review and approve student uploads</p>
            </div>

            {pendingMedia.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                <div className="text-6xl mb-4">✅</div>
                <p className="text-gray-500 text-lg">No pending uploads!</p>
                <p className="text-gray-400 text-sm mt-1">All student uploads have been reviewed.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {pendingMedia.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl overflow-hidden shadow-sm border-2 border-yellow-300">
                    <div className="aspect-video relative overflow-hidden bg-gray-100">
                      {item.type === 'photo' ? (
                        <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <video src={item.url} controls className="w-full h-full object-cover" />
                      )}
                      <span className="absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium bg-yellow-400 text-yellow-900">
                        ⏳ Pending
                      </span>
                      <span className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
                        item.type === 'photo' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-gray-800 text-lg">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                      )}
                      <div className="mt-2 p-2 bg-gray-50 rounded">
                        <p className="text-xs text-gray-600">
                          <strong>Uploaded by:</strong> {item.uploadedBy}
                        </p>
                        <p className="text-xs text-gray-600">
                          <strong>Assigned to:</strong> {item.studentId === 'all' ? 'All Students' : item.studentName || item.studentId}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleApproveMedia(item.id)}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleRejectMedia(item.id)}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Settings Tab */
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold mb-2">⚙️ Storage Settings</h2>
              <p className="text-gray-500 mb-6">Configure Cloudinary for 25GB FREE file storage (saved permanently!)</p>

              {/* Current Status */}
              <div className={`p-4 rounded-lg mb-6 ${cloudinaryConnected ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{cloudinaryConnected ? '✅' : '⚠️'}</span>
                  <div>
                    <p className={`font-medium ${cloudinaryConnected ? 'text-green-700' : 'text-yellow-700'}`}>
                      {cloudinaryConnected ? 'Cloudinary Connected!' : 'Cloudinary Not Connected'}
                    </p>
                    <p className={`text-sm ${cloudinaryConnected ? 'text-green-600' : 'text-yellow-600'}`}>
                      {cloudinaryConnected 
                        ? '25GB free storage available. Settings saved permanently in database!' 
                        : 'Configure Cloudinary to enable file uploads'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Setup Guide */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">📋 How to get Cloudinary credentials:</h3>
                <ol className="text-sm text-blue-700 space-y-1">
                  <li>1. Go to <a href="https://cloudinary.com/users/register_free" target="_blank" rel="noopener noreferrer" className="underline font-medium">cloudinary.com</a> and sign up (FREE)</li>
                  <li>2. After login, copy your <strong>Cloud Name</strong> from Dashboard</li>
                  <li>3. Go to Settings → Upload → Upload Presets</li>
                  <li>4. Click "Add upload preset" → Name it → Mode: <strong>Unsigned</strong></li>
                  <li>5. Enter both values below and click Save</li>
                </ol>
              </div>

              {/* Cloudinary Form */}
              <form onSubmit={handleSaveCloudinary} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cloud Name *</label>
                  <input
                    type="text"
                    value={cloudinaryForm.cloudName}
                    onChange={(e) => setCloudinaryForm({ ...cloudinaryForm, cloudName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., dxyz12345"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload Preset *</label>
                  <input
                    type="text"
                    value={cloudinaryForm.uploadPreset}
                    onChange={(e) => setCloudinaryForm({ ...cloudinaryForm, uploadPreset: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., class_x_media"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  💾 Save Cloudinary Settings (Permanent)
                </button>
              </form>

              {/* Disconnect Button */}
              {cloudinaryConnected && (
                <button
                  onClick={handleDisconnectCloudinary}
                  className="w-full mt-4 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                >
                  Disconnect Cloudinary
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Cloudinary Setup Popup (shows on login if not configured) */}
      {showCloudinaryPopup && !cloudinaryLoading && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-2">☁️ Configure Cloud Storage</h2>
            <p className="text-gray-500 mb-4">Set up Cloudinary for 25GB FREE file storage</p>
            
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                ⚠️ Cloud storage is required to upload files. Settings will be saved permanently.
              </p>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2 text-sm">Quick Setup:</h3>
              <ol className="text-xs text-blue-700 space-y-1">
                <li>1. Go to <a href="https://cloudinary.com/users/register_free" target="_blank" rel="noopener noreferrer" className="underline font-medium">cloudinary.com</a> → Sign up FREE</li>
                <li>2. Copy <strong>Cloud Name</strong> from Dashboard</li>
                <li>3. Settings → Upload → Add preset (Unsigned mode)</li>
              </ol>
            </div>

            <form onSubmit={handleSaveCloudinary} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cloud Name *</label>
                <input
                  type="text"
                  value={cloudinaryForm.cloudName}
                  onChange={(e) => setCloudinaryForm({ ...cloudinaryForm, cloudName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., dxyz12345"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Preset *</label>
                <input
                  type="text"
                  value={cloudinaryForm.uploadPreset}
                  onChange={(e) => setCloudinaryForm({ ...cloudinaryForm, uploadPreset: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., class_x_media"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCloudinaryPopup(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Skip for Now
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save & Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Form Modal */}
      {showStudentForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingStudent ? 'Edit Student' : 'Add New Student'}</h2>
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student ID *</label>
                  <input
                    type="text"
                    value={studentForm.studentId}
                    onChange={(e) => setStudentForm({ ...studentForm, studentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., STU001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input
                    type="text"
                    value={studentForm.password}
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Set password"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Student's full name"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll No</label>
                  <input
                    type="text"
                    value={studentForm.rollNo}
                    onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <input
                    type="text"
                    value={studentForm.class}
                    onChange={(e) => setStudentForm({ ...studentForm, class: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="X"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={studentForm.section}
                    onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="A"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="student@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={studentForm.phone}
                  onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="+91 9876543210"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetStudentForm}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingStudent ? 'Save Changes' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Form Modal */}
      {showMediaForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">📤 Upload Media</h2>
            <form onSubmit={handleMediaSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={mediaForm.title}
                  onChange={(e) => setMediaForm({ ...mediaForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Photo/Video title"
                  required
                  disabled={uploadProgress !== null}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={mediaForm.description}
                  onChange={(e) => setMediaForm({ ...mediaForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Optional description"
                  rows={2}
                  disabled={uploadProgress !== null}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign to *</label>
                <select
                  value={mediaForm.studentId}
                  onChange={(e) => setMediaForm({ ...mediaForm, studentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                  disabled={uploadProgress !== null}
                >
                  <option value="">Select recipient</option>
                  <option value="all" className="font-bold text-green-600">🌐 All Students</option>
                  <optgroup label="Individual Students">
                    {students.map((s) => (
                      <option key={s.id} value={s.studentId}>
                        {s.name} ({s.studentId})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Files * (Select Multiple)</label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => setMediaForm({ ...mediaForm, files: Array.from(e.target.files || []) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                  disabled={uploadProgress !== null}
                />
                {mediaForm.files.length > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    ✅ {mediaForm.files.length} file(s) selected
                  </p>
                )}
              </div>

              {uploadProgress && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700">
                      Uploading... {uploadProgress.current} of {uploadProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMediaForm({ title: '', description: '', studentId: '', files: [] })
                    setShowMediaForm(false)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  disabled={uploadProgress !== null}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  disabled={uploadProgress !== null}
                >
                  {uploadProgress ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
