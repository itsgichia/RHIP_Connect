import { useState } from 'react'
import {
  ArrowDownTrayIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { canInitiateChat } from '../../utils/roles'

export const PROFILE_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'study-with-me', label: 'Study With Me' },
  { id: 'insights', label: 'Insights' },
  { id: 'patents', label: 'Patents' },
  { id: 'projects', label: 'Projects' },
  { id: 'scholarly-works', label: 'Scholarly Works' },
  { id: 'news', label: 'News' },
  { id: 'awards', label: 'Awards' },
  { id: 'credentials', label: 'Credentials' },
]

function isScrollable(el) {
  if (!el) return false
  const { overflowY } = getComputedStyle(el)
  return (
    (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
    el.scrollHeight > el.clientHeight
  )
}

export function getScrollContainer(fromEl) {
  const start = fromEl || document.querySelector('main')
  if (start && isScrollable(start)) return start

  let el = start?.parentElement
  while (el) {
    if (isScrollable(el)) return el
    el = el.parentElement
  }

  return document.scrollingElement || document.documentElement
}

export function getObserverRoot() {
  const container = getScrollContainer()
  const viewport = document.scrollingElement || document.documentElement
  return container === viewport ? null : container
}

export function scrollToSection(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function scrollPageToTop() {
  getScrollContainer()?.scrollTo({ top: 0, behavior: 'smooth' })
}

export function ProfileSummaryBar({ profile, firstName }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [messageModalOpen, setMessageModalOpen] = useState(false)
  const [openingMessage, setOpeningMessage] = useState('')
  const [startingChat, setStartingChat] = useState(false)
  const canMessage = canInitiateChat(user?.role) && !profile.is_own_profile

  const handlePrint = () => window.print()

  const openMessagesThread = (threadId) => {
    setMessageModalOpen(false)
    setOpeningMessage('')
    navigate(`/messages/${threadId}`)
  }

  const handleStartMessage = async () => {
    if (!canMessage || startingChat) return
    setStartingChat(true)
    try {
      const { data } = await api.get(`/threads/by-profile/${profile.id}`)
      if (data.thread_id) {
        openMessagesThread(data.thread_id)
        return
      }
      setMessageModalOpen(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not open messages')
    } finally {
      setStartingChat(false)
    }
  }

  const handleSendOpeningMessage = async (e) => {
    e.preventDefault()
    if (!openingMessage.trim()) return
    setStartingChat(true)
    try {
      const { data } = await api.post('/threads/initiate-profile', {
        profile_id: profile.id,
        opening_message: openingMessage.trim(),
      })
      toast.success(data.is_new ? 'Message sent' : 'Opening conversation')
      openMessagesThread(data.thread_id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send message')
    } finally {
      setStartingChat(false)
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-gray-200 rounded-lg bg-white mb-8 print:hidden">
      <div className="p-5 border-b sm:border-b-0 sm:border-r border-gray-200">
        <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-2">Division</p>
        <p className="text-sm text-rhip-dark leading-snug">
          {profile.institution_name || 'RHIP Precinct'}
        </p>
      </div>

      <div className="p-5 border-b lg:border-b-0 lg:border-r border-gray-200">
        <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-2">
          Primary Interest
        </p>
        <p className="text-sm text-rhip-dark leading-snug">{profile.specialty_area}</p>
      </div>

      <button
        type="button"
        onClick={handlePrint}
        className="p-5 border-b sm:border-b-0 lg:border-r border-gray-200 text-left hover:bg-rhip-lightBg transition-colors"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-2">Print</p>
        <div className="flex items-center gap-2 text-sm text-rhip-dark">
          <ArrowDownTrayIcon className="w-4 h-4 shrink-0" />
          <span>{firstName}&apos;s Short Profile</span>
        </div>
      </button>

      <div className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-2">Enquiries</p>
        {canMessage ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleStartMessage}
              disabled={startingChat}
              className="flex items-center gap-2 w-full text-sm text-rhip-dark hover:text-rhip-teal transition-colors disabled:opacity-50"
            >
              <PaperAirplaneIcon className="w-4 h-4 shrink-0" />
              {startingChat ? 'Opening Messages…' : 'Contact'}
            </button>
            <Link
              to="/challenges"
              className="block text-xs text-rhip-muted hover:text-rhip-teal hover:underline"
            >
              Or post a collaboration challenge
            </Link>
          </div>
        ) : (
          <p className="text-sm text-rhip-muted">
            {profile.is_own_profile ? 'This is your profile' : 'Messaging unavailable for your role'}
          </p>
        )}
      </div>
    </div>

      {messageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-rhip-dark">
                  Message {firstName}
                </h3>
                <p className="text-sm text-rhip-muted mt-1">
                  Introduce yourself to start a conversation from the Expertise Directory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessageModalOpen(false)
                  setOpeningMessage('')
                }}
                className="text-rhip-muted hover:text-rhip-dark"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendOpeningMessage}>
              <textarea
                value={openingMessage}
                onChange={(e) => setOpeningMessage(e.target.value)}
                placeholder="Introduce yourself and explain what you're looking for..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMessageModalOpen(false)
                    setOpeningMessage('')
                  }}
                  className="px-4 py-2 text-sm text-rhip-body border border-gray-200 rounded-xl hover:bg-rhip-lightBg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!openingMessage.trim() || startingChat}
                  className="px-4 py-2 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam disabled:opacity-50"
                >
                  {startingChat ? 'Sending…' : 'Send & open Messages'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export function ProfileSectionNav({ activeSection, onNavigate }) {
  const scrollToTop = () => scrollPageToTop()

  return (
    <nav className="bg-white border border-gray-200 rounded-lg overflow-hidden print:hidden">
      <button
        type="button"
        onClick={scrollToTop}
        className="w-full text-left px-4 py-3 text-sm text-rhip-teal border-b border-gray-200 hover:bg-rhip-lightBg transition-colors"
      >
        Scroll to top ↑
      </button>
      <ul>
        {PROFILE_SECTIONS.map(({ id, label }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onNavigate(id)}
              className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                activeSection === id
                  ? 'bg-rhip-lightBg text-rhip-dark font-medium'
                  : 'text-rhip-body hover:bg-rhip-lightBg/60'
              }`}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function ProfileSection({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-6 pb-10 border-b border-gray-200 last:border-b-0">
      <h2 className="font-display text-xl font-semibold text-rhip-dark mb-4">{title}</h2>
      {children}
    </section>
  )
}

export function EmptySection({ message }) {
  return <p className="text-sm text-rhip-muted italic">{message}</p>
}
