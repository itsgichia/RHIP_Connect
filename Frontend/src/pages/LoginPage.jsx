import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import PublicNavBar from '../components/layout/PublicNavBar'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, loading } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-rhip-lightBg">
      <PublicNavBar hideLogin />
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
          <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-2">Log In</h1>
          <p className="text-rhip-muted text-sm mb-6">Access the RHIP Connect platform</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-rhip-body mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-rhip-body mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam transition-colors disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
          <div className="mt-4 text-center text-sm text-rhip-muted space-y-2">
            <p>
              <Link to="/auth/forgot-password" className="text-rhip-teal hover:underline">
                Forgot password?
              </Link>
            </p>
            <p>
              Don&apos;t have an account?{' '}
              <Link to="/auth/signup" className="text-rhip-teal hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
