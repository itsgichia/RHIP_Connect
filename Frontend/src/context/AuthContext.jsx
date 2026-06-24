import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../hooks/useApi'
import { firebaseLogin, useFirebaseAuth } from '../lib/authHelpers'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (email, password) => {
    setLoading(true)
    try {
      let data
      if (useFirebaseAuth()) {
        try {
          data = await firebaseLogin(email, password)
        } catch (firebaseErr) {
          const code = firebaseErr?.code
          if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
            const res = await api.post('/auth/login', { email, password })
            data = { ...res.data, email }
          } else {
            throw firebaseErr
          }
        }
      } else {
        const res = await api.post('/auth/login', { email, password })
        data = { ...res.data, email }
      }
      const userData = {
        id: data.user_id,
        name: data.name,
        role: data.role,
        email,
      }
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
      return userData
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const isAuthenticated = !!user && !!localStorage.getItem('access_token')

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
