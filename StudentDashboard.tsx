import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase, isSupabaseConfigured } from './supabase-config'
import MediaModal from './MediaModal'

interface Media {
  id: string
  title: string
  type: 'photo' | 'video'
  url: string
  description: string
  studentId: string
  createdAt: string
}

export default function StudentDashboard() {
  const { isStudentLoggedIn, currentStudent, logout } = useAuth()
  const navigate = useNavigate()
  const [media, setMedia] = useState<Media[]>([])
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all')
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null)
  const [loading, setLoading] = useState(true)

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
        const { data, error } = await supabase
          .from('media')
          .select('*')
          .eq('student_id', currentStudent.studentId)
          .order('created_at', { ascending: false })

        if (error) throw error

        setMedia(data?.map(item => ({
          id: item.id,
          title: item.title,
          type: item.type,
          url: item.url,
          description: item.description || '',
          studentId: item.student_id,
          createdAt: item.created_at
        })) || [])
      } else {
        // localStorage fallback
        const storedMedia = localStorage.getItem('classX_media')
        if (storedMedia) {
          const allMedia: Media[] = JSON.parse(storedMedia)
          setMedia(allMedia.filter(m => m.studentId === currentStudent.studentId))
        }
      }
    } catch (error) {
      console.error('Error loading media:', error)
    }

    setLoading(false)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const filteredMedia = media.filter(m => filter === 'all' || m.type === filter)

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
          ? '🟢 Supabase Connected - Real-time sync enabled' 
          : '🟡 Local Mode - Data stored in browser only'}
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-3xl font-bold text-blue-600">{media.length}</p>
            <p className="text-gray-500">Total Media</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-3xl font-bold text-green-600">{media.filter(m => m.type === 'photo').length}</p>
            <p className="text-gray-500">Photos</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-3xl font-bold text-purple-600">{media.filter(m => m.type === 'video').length}</p>
            <p className="text-gray-500">Videos</p>
          </div>
        </div>

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

        {/* Media Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading your media...</p>
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500">No media uploaded yet</p>
            <p className="text-sm text-gray-400 mt-1">Your admin will upload photos and videos soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredMedia.map((item) => (
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
                  {item.description && (
                    <p className="text-sm text-gray-500 truncate">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Media Modal */}
      {selectedMedia && (
        <MediaModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
      )}
    </div>
  )
}
