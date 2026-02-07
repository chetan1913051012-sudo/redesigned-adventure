import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase, isSupabaseConfigured } from './supabase-config'

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
  createdAt: string
}

export default function AdminDashboard() {
  const { isAdminLoggedIn, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'students' | 'media'>('students')
  const [students, setStudents] = useState<Student[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [showStudentForm, setShowStudentForm] = useState(false)
  const [showMediaForm, setShowMediaForm] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

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
    file: null as File | null
  })

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
          createdAt: m.created_at
        })) || [])
      } else {
        const stored = localStorage.getItem('classX_media')
        if (stored) setMedia(JSON.parse(stored))
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

  const handleMediaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!mediaForm.file || !mediaForm.studentId) {
      alert('Please select a file and student')
      return
    }

    const selectedStudent = students.find(s => s.studentId === mediaForm.studentId)
    const mediaType = mediaForm.file.type.startsWith('video/') ? 'video' : 'photo'

    try {
      let fileUrl = ''

      if (isSupabaseConfigured() && supabase) {
        // Upload file to Supabase Storage
        const fileName = `${Date.now()}_${mediaForm.file.name}`
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, mediaForm.file)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName)
        fileUrl = urlData.publicUrl

        // Save media record
        const { error } = await supabase.from('media').insert({
          title: mediaForm.title,
          type: mediaType,
          url: fileUrl,
          description: mediaForm.description,
          student_id: mediaForm.studentId,
          student_name: selectedStudent?.name || ''
        })

        if (error) throw error
      } else {
        // localStorage fallback - convert file to base64
        const reader = new FileReader()
        reader.onload = () => {
          const newMedia: Media = {
            id: Date.now().toString(),
            title: mediaForm.title,
            type: mediaType,
            url: reader.result as string,
            description: mediaForm.description,
            studentId: mediaForm.studentId,
            studentName: selectedStudent?.name,
            createdAt: new Date().toISOString()
          }
          const updated = [...media, newMedia]
          setMedia(updated)
          localStorage.setItem('classX_media', JSON.stringify(updated))
        }
        reader.readAsDataURL(mediaForm.file)
      }

      setMediaForm({ title: '', description: '', studentId: '', file: null })
      setShowMediaForm(false)
      loadMedia()
    } catch (error) {
      console.error('Error uploading media:', error)
      alert('Error uploading media. Please try again.')
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

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.rollNo.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          ? '🟢 Supabase Connected - Real-time sync enabled across all devices' 
          : '🟡 Local Mode - Data stored in browser only. Configure Supabase for real-time sync.'}
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'students'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            👥 Students ({students.length})
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'media'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📷 Media ({media.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
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
        ) : (
          <div>
            {/* Media Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">📷 Media Gallery</h2>
                <p className="text-sm text-gray-500">Upload photos and videos for students</p>
              </div>
              <button
                onClick={() => setShowMediaForm(true)}
                disabled={students.length === 0}
                className={`px-4 py-2 rounded-lg transition font-medium ${
                  students.length === 0
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
                  You need to add students first before uploading media. Go to the{' '}
                  <button
                    onClick={() => setActiveTab('students')}
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    Students tab
                  </button>{' '}
                  and add at least one student.
                </p>
              </div>
            )}

            {/* Media Grid */}
            {media.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                <div className="text-6xl mb-4">📷</div>
                <p className="text-gray-500 text-lg">No media uploaded yet.</p>
                {students.length > 0 && (
                  <p className="text-gray-400 text-sm mt-2">Click "Upload Media" to add photos or videos.</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {media.map((item) => (
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
                      <p className="text-sm text-blue-600">📌 {item.studentName || item.studentId}</p>
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
        )}
      </main>

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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <input
                    type="text"
                    value={studentForm.class}
                    onChange={(e) => setStudentForm({ ...studentForm, class: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="X"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={studentForm.section}
                    onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="student@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={studentForm.phone}
                  onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
            <h2 className="text-xl font-bold mb-4">Upload Media</h2>
            <form onSubmit={handleMediaSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={mediaForm.title}
                  onChange={(e) => setMediaForm({ ...mediaForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Photo/Video title"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={mediaForm.description}
                  onChange={(e) => setMediaForm({ ...mediaForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Optional description"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Student *</label>
                <select
                  value={mediaForm.studentId}
                  onChange={(e) => setMediaForm({ ...mediaForm, studentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select a student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.studentId}>
                      {s.name} ({s.studentId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setMediaForm({ ...mediaForm, file: e.target.files?.[0] || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMediaForm({ title: '', description: '', studentId: '', file: null })
                    setShowMediaForm(false)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
