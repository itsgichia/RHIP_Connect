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

  const persistSession = useCallback((data, email) => {
    const userData = {
      id: data.user_id,
      name: data.name,
      role: data.role,
      email,
      identity_facets: data.identity_facets || [],
      primary_lens: data.primary_lens || null,
      career_level: data.career_level || null,
      profile_id: data.profile_id || null,
    }
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const login = useCallback(async (email, password) => {
    setLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()

      const loginViaBackend = async () => {
        const res = await api.post('/auth/login', {
          email: normalizedEmail,
          password,
        })
        return { ...res.data, email: normalizedEmail }
      }

      const shouldFallbackToBackend = (firebaseErr) => {
        const code = firebaseErr?.code
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
          return true
        }
        // Seeded demo users are verified in the DB but may have an unverified Firebase account.
        return Boolean(firebaseErr?.message?.includes('verify your email'))
      }

      let data
      if (useFirebaseAuth()) {
        try {
          data = await firebaseLogin(normalizedEmail, password)
        } catch (firebaseErr) {
          if (shouldFallbackToBackend(firebaseErr)) {
            data = await loginViaBackend()
          } else {
            throw firebaseErr
          }
        }
      } else {
        data = await loginViaBackend()
      }
      return persistSession(data, normalizedEmail)
    } finally {
      setLoading(false)
    }
  }, [persistSession])

  const institutionalLogin = useCallback(async (payload) => {
    setLoading(true)
    try {
      const normalizedEmail = payload.email.trim().toLowerCase()
      const res = await api.post('/auth/institutional/login', {
        ...payload,
        email: normalizedEmail,
      })
      return persistSession(res.data, normalizedEmail)
    } finally {
      setLoading(false)
    }
  }, [persistSession])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem('user', JSON.stringify(next))
      return next
    })
  }, [])

  const isAuthenticated = !!user && !!localStorage.getItem('access_token')

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, login, institutionalLogin, logout, updateUser, isAuthenticated, loading }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
