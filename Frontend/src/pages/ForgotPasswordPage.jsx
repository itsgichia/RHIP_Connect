import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../hooks/useApi'
import { firebaseForgotPassword, useFirebaseAuth } from '../lib/authHelpers'
import PublicNavBar from '../components/layout/PublicNavBar'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (useFirebaseAuth()) {
        await firebaseForgotPassword(email)
      } else {
        await api.post('/auth/forgot-password', { email })
      }
      setSent(true)
    } catch (err) {
      toast.error(err.message || 'Could not send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-rhip-lightBg">
      <PublicNavBar hideLogin />
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
          <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-2">Forgot Password</h1>
          {sent ? (
            <p className="text-rhip-muted">
              If that email is registered, a reset link has been sent.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam transition-colors"
              >
                Send reset link
              </button>
            </form>
          )}
          <Link to="/auth/login" className="inline-block mt-4 text-sm text-rhip-teal hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
