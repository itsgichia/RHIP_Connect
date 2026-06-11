import { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import api from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { canPostChallenge } from '../utils/roles'
import ChallengeForm from '../components/forms/ChallengeForm'
import MatchCard from '../components/ui/MatchCard'

export default function ChallengePage() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [matches, setMatches] = useState([])
  const [status, setStatus] = useState(null)
  const [sentMatches, setSentMatches] = useState(new Set())

  const fetchChallenges = useCallback(async () => {
    const { data } = await api.get('/challenges')
    setChallenges(data.challenges)
  }, [])

  useEffect(() => {
    fetchChallenges()
  }, [fetchChallenges])

  const pollMatches = useCallback(async (id) => {
    const { data } = await api.get(`/challenges/${id}/matches`)
    setMatches(data.matches)
    setStatus(data.challenge_status)
    return data.challenge_status
  }, [])

  useEffect(() => {
    if (!activeId) return undefined
    let interval
    const poll = async () => {
      const s = await pollMatches(activeId)
      if (s === 'matched') clearInterval(interval)
    }
    poll()
    interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [activeId, pollMatches])

  const handleCreated = (id) => {
    setActiveId(id)
    setMatches([])
    setStatus('pending')
    fetchChallenges()
  }

  const selectChallenge = (id) => {
    setActiveId(id)
    pollMatches(id)
  }

  const handleSend = (matchId, message) => {
    setSentMatches((prev) => new Set([...prev, matchId]))
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-6">Challenge Board</h1>
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {canPostChallenge(user?.role) && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-semibold text-rhip-dark mb-4">Post a Challenge</h2>
              <ChallengeForm onCreated={handleCreated} />
            </div>
          )}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-semibold text-rhip-dark mb-4">Open Challenges</h2>
            <div className="space-y-3">
              {challenges.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectChallenge(c.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    activeId === c.id
                      ? 'border-rhip-teal bg-rhip-lightTeal'
                      : 'border-gray-100 hover:border-rhip-teal/30'
                  }`}
                >
                  <p className="font-medium text-rhip-dark text-sm">{c.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 bg-rhip-cardBg rounded-full text-rhip-muted">
                      {c.specialty_area}
                    </span>
                    <span className="text-xs text-rhip-muted">
                      {c.posted_by?.name} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))}
              {challenges.length === 0 && (
                <p className="text-sm text-rhip-muted">No challenges yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl p-6 shadow-sm min-h-[400px]">
            {!activeId && (
              <div className="flex items-center justify-center h-64 text-rhip-muted">
                Post a challenge to see AI-matched researchers
              </div>
            )}
            {activeId && (status === 'pending' || status === 'matching') && (
              <div className="flex flex-col items-center justify-center h-64">
                <div className="w-12 h-12 border-4 border-rhip-teal border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-rhip-teal font-medium">Qwen is searching precinct profiles…</p>
                <p className="text-sm text-rhip-muted mt-2">Finding the best researcher matches</p>
              </div>
            )}
            {activeId && status === 'matched' && (
              <div>
                <h2 className="font-semibold text-rhip-dark mb-6">Top 3 Matches</h2>
                <div className="space-y-4">
                  {matches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      sent={sentMatches.has(m.id)}
                      onSend={handleSend}
                    />
                  ))}
                  {matches.length === 0 && (
                    <p className="text-rhip-muted">No matches found for this specialty area.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
