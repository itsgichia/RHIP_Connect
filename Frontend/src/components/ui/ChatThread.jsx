import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../hooks/useApi'
import { useNotifications } from '../../context/NotificationContext'
import MessageTime from './MessageTime'

export default function ChatThread({
  threadId,
  threadStatus,
  challengeContext,
  canRespond,
  onStatusChange,
}) {
  const { refresh: refreshNotifications } = useNotifications()
  const [messages, setMessages] = useState([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const loadMessages = async () => {
    if (!threadId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/threads/${threadId}/messages`)
      setMessages(data.messages)
      onStatusChange?.(data.thread_status, data.can_respond)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
  }, [threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const respond = async (accepted) => {
    try {
      const { data } = await api.post(`/threads/${threadId}/respond`, { accepted })
      onStatusChange?.(data.status)
      toast.success(accepted ? 'Connection accepted' : 'Connection declined')
      refreshNotifications()
      await loadMessages()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not respond')
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!content.trim() || threadStatus !== 'active') return
    setSending(true)
    try {
      const { data } = await api.post(`/threads/${threadId}/messages`, { content: content.trim() })
      setMessages((prev) => [...prev, data])
      setContent('')
      refreshNotifications()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send message')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <p className="text-rhip-muted text-center py-12">Loading conversation…</p>
  }

  return (
    <div className="flex flex-col h-full min-h-[480px]">
      {challengeContext && (
        <div className="bg-rhip-lightTeal rounded-xl p-4 mb-4 border border-rhip-teal/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 bg-white rounded-full text-rhip-teal">
              {challengeContext.specialty_area}
            </span>
            {threadStatus === 'active' && (
              <span className="text-xs px-2 py-0.5 bg-rhip-teal text-white rounded-full">Active</span>
            )}
            {threadStatus === 'pending' && (
              <span className="text-xs px-2 py-0.5 bg-rhip-amber text-white rounded-full">Pending</span>
            )}
            {threadStatus === 'declined' && (
              <span className="text-xs px-2 py-0.5 bg-gray-400 text-white rounded-full">Declined</span>
            )}
          </div>
          <h3 className="font-semibold text-rhip-dark">{challengeContext.title}</h3>
          {challengeContext.posted_by_name && (
            <p className="text-xs text-rhip-muted mt-1">Posted by {challengeContext.posted_by_name}</p>
          )}
          <p className="text-sm text-rhip-body mt-2 line-clamp-3">{challengeContext.description}</p>
        </div>
      )}

      {threadStatus === 'pending' && canRespond && (
        <div className="bg-white border border-rhip-amber/30 rounded-xl p-4 mb-4">
          <p className="text-sm text-rhip-body mb-3">This connection request is awaiting your response.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => respond(true)}
              className="px-4 py-2 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => respond(false)}
              className="px-4 py-2 border border-gray-200 text-rhip-body rounded-xl text-sm hover:bg-rhip-lightBg"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {threadStatus === 'pending' && !canRespond && (
        <p className="text-sm text-rhip-muted text-center mb-4">Waiting for the other party to respond…</p>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                msg.is_mine
                  ? 'bg-rhip-teal text-white rounded-br-md'
                  : 'bg-gray-100 text-rhip-body rounded-bl-md'
              }`}
            >
              {!msg.is_mine && (
                <p className="text-[10px] font-medium mb-1 opacity-70">{msg.sender_name}</p>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <MessageTime
                value={msg.created_at}
                className={`text-[10px] mt-1 block ${msg.is_mine ? 'text-white/70' : 'text-rhip-muted'}`}
              />
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {threadStatus === 'active' && (
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          />
          <button
            type="submit"
            disabled={!content.trim() || sending}
            className="px-4 py-2 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}

      {threadStatus === 'declined' && (
        <p className="text-sm text-rhip-muted text-center py-4">This connection was declined.</p>
      )}
    </div>
  )
}
