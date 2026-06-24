import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import DashboardPage from './pages/DashboardPage'
import DirectoryPage from './pages/DirectoryPage'
import ProfilePage from './pages/ProfilePage'
import ChallengePage from './pages/ChallengePage'
import MessagesPage from './pages/MessagesPage'
import PipelinePage from './pages/PipelinePage'
import PassportPage from './pages/PassportPage'
import AdminPage from './pages/AdminPage'
import InvestorPage from './pages/InvestorPage'
import CommunityPage from './pages/CommunityPage'
import CommunityServicesPage from './pages/CommunityServicesPage'
import CommunityServiceDetailPage from './pages/CommunityServiceDetailPage'
import CommunitySpecialistsPage from './pages/CommunitySpecialistsPage'
import CommunitySpecialistDetailPage from './pages/CommunitySpecialistDetailPage'

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/community/services" element={<CommunityServicesPage />} />
          <Route path="/community/services/:slug" element={<CommunityServiceDetailPage />} />
          <Route path="/community/specialists" element={<CommunitySpecialistsPage />} />
          <Route path="/community/specialists/:slug" element={<CommunitySpecialistDetailPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignupPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/auth/verify/:token" element={<VerifyEmailPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/directory" element={<DirectoryPage />} />
            <Route path="/directory/:profileId" element={<ProfilePage />} />
            <Route path="/challenges" element={<ChallengePage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:threadId" element={<MessagesPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/passport" element={<PassportPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/investor" element={<InvestorPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}
