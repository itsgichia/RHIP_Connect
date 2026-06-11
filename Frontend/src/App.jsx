import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import DashboardPage from './pages/DashboardPage'
import DirectoryPage from './pages/DirectoryPage'
import ChallengePage from './pages/ChallengePage'

function PlaceholderPage({ title }) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
      <h1 className="font-display text-xl font-semibold text-rhip-dark">{title}</h1>
      <p className="text-rhip-muted mt-2">Coming in Week 6–7</p>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignupPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/auth/verify/:token" element={<VerifyEmailPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/directory" element={<DirectoryPage />} />
            <Route path="/challenges" element={<ChallengePage />} />
            <Route path="/pipeline" element={<PlaceholderPage title="Innovation Pipeline" />} />
            <Route path="/passport" element={<PlaceholderPage title="Precinct Passport" />} />
            <Route path="/admin" element={<PlaceholderPage title="Admin Panel" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
