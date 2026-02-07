import { createContext, useContext, useState, ReactNode } from 'react'

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

interface AuthContextType {
  isAdminLoggedIn: boolean
  isStudentLoggedIn: boolean
  currentStudent: Student | null
  adminLogin: (username: string, password: string) => boolean
  studentLogin: (student: Student) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false)
  const [isStudentLoggedIn, setIsStudentLoggedIn] = useState(false)
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null)

  const adminLogin = (username: string, password: string): boolean => {
    if (username === 'admin' && password === 'admin123') {
      setIsAdminLoggedIn(true)
      return true
    }
    return false
  }

  const studentLogin = (student: Student) => {
    setCurrentStudent(student)
    setIsStudentLoggedIn(true)
  }

  const logout = () => {
    setIsAdminLoggedIn(false)
    setIsStudentLoggedIn(false)
    setCurrentStudent(null)
  }

  return (
    <AuthContext.Provider value={{
      isAdminLoggedIn,
      isStudentLoggedIn,
      currentStudent,
      adminLogin,
      studentLogin,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
