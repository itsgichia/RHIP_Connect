import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import api from '../hooks/useApi'
import ChatThread from '../components/ui/ChatThread'
import { canInitiateChat } from '../utils/roles'
import { useAuth } from '../context/AuthContext'

export default function MessagesPage() {
  const { threadId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [threadStatus, setThreadStatus] = useState(null)
  const [canRespond, setCanRespond] = useState(false)

  const fetchThreads = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/threads')
      setThreads(data.threads)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  useEffect(() => {
    if (!threadId) {
      setThreadStatus(null)
      setChallengeContext(null)
      setCanRespond(false)
      return
    }
    const load = async () => {
      const { data } = await api.get(`/threads/${threadId}/messages`)
      setThreadStatus(data.thread_status)
      setChallengeContext(data.challenge_context)
      setCanRespond(data.can_respond)
    }
    load()
  }, [threadId])

  if (!canInitiateChat(user?.role)) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
        <p className="text-rhip-muted">Messaging is not available for your role.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-6">Messages</h1>
      <div className="grid lg:grid-cols-3 gap-6 min-h-[560px]">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-rhip-dark text-sm">Conversations</h2>
          </div>
          {loading ? (
            <p className="p-4 text-sm text-rhip-muted">Loading…</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
              {threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/messages/${t.id}`)}
                  className={`w-full text-left px-4 py-3 hover:bg-rhip-lightBg transition-colors ${
                    threadId === t.id ? 'bg-rhip-lightTeal/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm text-rhip-dark truncate">{t.other_participant_name}</p>
                    {t.unread && (
                      <span className="w-2 h-2 bg-rhip-coral rounded-full flex-shrink-0" />
                    )}
                  </div>
                  {t.challenge_title && (
                    <p className="text-xs text-rhip-teal truncate mt-0.5">{t.challenge_title}</p>
                  )}
                  {t.last_message_snippet && (
                    <p className="text-xs text-rhip-muted truncate mt-1">{t.last_message_snippet}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {t.pending_response && (
                      <span className="text-[10px] px-2 py-0.5 bg-rhip-amber/20 text-rhip-amber rounded-full">
                        Action needed
                      </span>
                    )}
                    {t.last_message_at && (
                      <span className="text-[10px] text-rhip-muted">
                        {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {threads.length === 0 && (
                <p className="p-6 text-sm text-rhip-muted text-center">
                  No conversations yet. Start one from a challenge match.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
          {threadId ? (
            <ChatThread
              threadId={threadId}
              threadStatus={threadStatus}
              challengeContext={challengeContext}
              canRespond={canRespond}
              onStatusChange={(status, respond) => {
                setThreadStatus(status)
                if (respond !== undefined) setCanRespond(respond)
                fetchThreads()
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full min-h-[480px] text-rhip-muted">
              Select a conversation or connect from the Challenge Board
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
