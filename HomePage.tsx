import { Link } from 'react-router-dom';
import { GraduationCap, Users, Shield, ArrowRight, Camera, Video } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div className="text-white">
              <h1 className="text-2xl font-bold">Class X Portal</h1>
              <p className="text-white/70 text-sm">Student Media Gallery</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Welcome Text */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Welcome to Class X
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-400">
                Student Portal
              </span>
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Access your photos and videos uploaded by the admin. Choose your role below to continue.
            </p>
          </div>

          {/* Floating Icons */}
          <div className="flex justify-center gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-full animate-bounce delay-100">
              <Camera className="w-8 h-8 text-pink-400" />
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-full animate-bounce delay-300">
              <Video className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Student Card */}
            <Link
              to="/student/login"
              className="group bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-4 rounded-xl group-hover:scale-110 transition-transform">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Student</h3>
                  <p className="text-gray-500">View your media</p>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                Login with your Student ID and Password to view photos and videos shared by the admin specifically for you.
              </p>

              <div className="flex items-center text-blue-600 font-semibold group-hover:gap-3 transition-all">
                Student Login
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Admin Card */}
            <Link
              to="/admin/login"
              className="group bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-xl group-hover:scale-110 transition-transform">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Admin</h3>
                  <p className="text-gray-500">Manage students & media</p>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                Manage student accounts, upload photos and videos, and assign media to specific students.
              </p>

              <div className="flex items-center text-purple-600 font-semibold group-hover:gap-3 transition-all">
                Admin Login
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>

          {/* Features */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { icon: '📸', text: 'Photos' },
              { icon: '🎬', text: 'Videos' },
              { icon: '🔒', text: 'Secure' },
              { icon: '⚡', text: 'Real-time' },
            ].map((item) => (
              <div key={item.text} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="text-white font-medium">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-white/50 text-sm">
        © {new Date().getFullYear()} Class X Portal. All rights reserved.
      </footer>
    </div>
  );
}
