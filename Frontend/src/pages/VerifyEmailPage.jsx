import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../hooks/useApi'
import PublicNavBar from '../components/layout/PublicNavBar'

export default function VerifyEmailPage() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get(`/auth/verify/${token}`)
      .then((res) => {
        setStatus('success')
        setMessage(res.data.message)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.response?.data?.detail || 'This link has expired or is invalid.')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-rhip-lightBg">
      <PublicNavBar hideLogin />
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-center">
          {status === 'loading' && <p className="text-rhip-muted">Verifying your email...</p>}
          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-rhip-lightTeal rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-rhip-teal">✓</span>
              </div>
              <h2 className="font-display text-xl font-semibold text-rhip-dark mb-2">Email verified!</h2>
              <p className="text-rhip-muted mb-6">{message}</p>
              <Link
                to="/auth/login"
                className="inline-block px-6 py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam"
              >
                Log In
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <h2 className="font-display text-xl font-semibold text-rhip-coral mb-2">Verification failed</h2>
              <p className="text-rhip-muted">{message}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
