import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { canPostChallenge } from '../utils/roles'
import ChallengeForm from '../components/forms/ChallengeForm'
import MatchCard from '../components/ui/MatchCard'
import RelativeTime from '../components/ui/RelativeTime'

function IncomingMatchDetail({ match }) {
  const pct = Math.round(match.score * 100)

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-rhip-teal text-white">
            {match.rank === 1 ? 'Top match' : `Match #${match.rank}`}
          </span>
          <span className="text-xs px-2 py-0.5 bg-rhip-cardBg rounded-full text-rhip-muted">
            {match.challenge.specialty_area}
          </span>
        </div>
        <h2 className="font-display text-xl font-semibold text-rhip-dark">{match.challenge.title}</h2>
        <p className="text-sm text-rhip-muted mt-1">
          Posted by {match.challenge.posted_by?.name || 'A precinct member'}
          {' · '}
          <RelativeTime value={match.challenge.created_at} className="inline" />
        </p>
      </div>

      <p className="text-rhip-body leading-relaxed">{match.challenge.description}</p>

      <div className="bg-rhip-lightBg rounded-xl p-4">
        <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide mb-2">
          Why you were matched
        </p>
        <div className="flex justify-between text-xs text-rhip-muted mb-1">
          <span>Match score</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-white rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-rhip-teal rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm italic text-rhip-body">{match.reasoning}</p>
      </div>

      {match.thread_id ? (
        <Link
          to={`/messages/${match.thread_id}`}
          className="inline-flex px-5 py-2.5 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam transition-colors"
        >
          View conversation →
        </Link>
      ) : (
        <div className="bg-rhip-lightTeal rounded-xl p-4 text-sm text-rhip-body">
          <p className="font-medium text-rhip-dark mb-1">Waiting for connection</p>
          <p className="text-rhip-muted">
            The poster may send you a connection request. Check{' '}
            <Link to="/messages" className="text-rhip-teal hover:underline">Messages</Link>{' '}
            for incoming requests.
          </p>
        </div>
      )}
    </div>
  )
}

export default function ChallengePage() {
  const { user } = useAuth()
  const { refresh: refreshNotifications } = useNotifications()
  const [searchParams, setSearchParams] = useSearchParams()
  const canPost = canPostChallenge(user?.role)

  const [challenges, setChallenges] = useState([])
  const [incomingMatches, setIncomingMatches] = useState([])
  const [incomingLoading, setIncomingLoading] = useState(true)
  const [activePostedId, setActivePostedId] = useState(null)
  const [activeIncomingId, setActiveIncomingId] = useState(null)
  const [panel, setPanel] = useState('posted') // 'posted' | 'incoming'
  const [matches, setMatches] = useState([])
  const [status, setStatus] = useState(null)
  const [sentMatches, setSentMatches] = useState(new Set())

  const fetchMyChallenges = useCallback(async () => {
    if (!canPost) return
    const { data } = await api.get('/challenges', { params: { mine: true } })
    setChallenges(data.challenges)
  }, [canPost])

  const fetchIncoming = useCallback(async () => {
    setIncomingLoading(true)
    try {
      const { data } = await api.get('/challenges/matched-for-me')
      setIncomingMatches(data.matches)
    } finally {
      setIncomingLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMyChallenges()
    fetchIncoming()
  }, [fetchMyChallenges, fetchIncoming])

  useEffect(() => {
    const challengeId = searchParams.get('challenge')
    if (!challengeId) return

    const isMine = challenges.some((c) => c.id === challengeId)
    const isIncoming = incomingMatches.some((m) => m.challenge.id === challengeId)

    if (isMine) {
      setPanel('posted')
      setActivePostedId(challengeId)
      setActiveIncomingId(null)
    } else if (isIncoming) {
      setPanel('incoming')
      setActiveIncomingId(challengeId)
      setActivePostedId(null)
    } else if (!incomingLoading && challenges.length >= 0) {
      // Deep-link before lists load, or match not yet in mine list — prefer posted poll
      setPanel('posted')
      setActivePostedId(challengeId)
    }
  }, [searchParams, challenges, incomingMatches, incomingLoading])

  const pollMatches = useCallback(async (id) => {
    const { data } = await api.get(`/challenges/${id}/matches`)
    setMatches(data.matches)
    setStatus(data.challenge_status)
    return data.challenge_status
  }, [])

  useEffect(() => {
    if (panel !== 'posted' || !activePostedId) return undefined
    let interval
    const poll = async () => {
      const s = await pollMatches(activePostedId)
      if (s === 'matched') clearInterval(interval)
    }
    poll()
    interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [panel, activePostedId, pollMatches])

  const handleCreated = (id) => {
    setPanel('posted')
    setActivePostedId(id)
    setActiveIncomingId(null)
    setMatches([])
    setStatus('pending')
    fetchMyChallenges()
    setSearchParams({ challenge: id })
  }

  const selectPosted = (id) => {
    setPanel('posted')
    setActivePostedId(id)
    setActiveIncomingId(null)
    setSearchParams({ challenge: id })
    pollMatches(id)
  }

  const selectIncoming = (challengeId) => {
    setPanel('incoming')
    setActiveIncomingId(challengeId)
    setActivePostedId(null)
    setSearchParams({ challenge: challengeId })
  }

  const handleSend = async (matchId, message) => {
    try {
      await api.post('/threads/initiate', { match_id: matchId, opening_message: message })
      setSentMatches((prev) => new Set([...prev, matchId]))
      refreshNotifications()
      toast.success('Connection request sent')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send connection request')
    }
  }

  const activeIncoming = useMemo(
    () => incomingMatches.find((m) => m.challenge.id === activeIncomingId) || null,
    [incomingMatches, activeIncomingId]
  )

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-2">Challenge Board</h1>
      <p className="text-rhip-muted mb-6">
        One board for verified precinct members — clinicians, researchers, PhD students, and
        related roles. Post a need or opportunity, get AI-matched collaborators, and connect in
        Messages. You can also review challenges where your profile was matched.
      </p>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {canPost && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-semibold text-rhip-dark mb-4">Post a Challenge</h2>
              <ChallengeForm onCreated={handleCreated} />
            </div>
          )}

          {canPost && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-semibold text-rhip-dark mb-4">My Challenges</h2>
              <div className="space-y-3">
                {challenges.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectPosted(c.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      panel === 'posted' && activePostedId === c.id
                        ? 'border-rhip-teal bg-rhip-lightTeal'
                        : 'border-gray-100 hover:border-rhip-teal/30'
                    }`}
                  >
                    <p className="font-medium text-rhip-dark text-sm">{c.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-rhip-cardBg rounded-full text-rhip-muted">
                        {c.specialty_area}
                      </span>
                      <span className="text-xs text-rhip-muted capitalize">{c.status}</span>
                    </div>
                  </button>
                ))}
                {challenges.length === 0 && (
                  <p className="text-sm text-rhip-muted">
                    No challenges yet. Post one to find matched collaborators.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-semibold text-rhip-dark mb-1">Matches for you</h2>
            <p className="text-sm text-rhip-muted mb-4">
              Challenges where AI matched your expertise.
            </p>
            {incomingLoading ? (
              <p className="text-sm text-rhip-muted">Loading matches…</p>
            ) : (
              <div className="space-y-3">
                {incomingMatches.map((m) => (
                  <button
                    key={m.match_id}
                    type="button"
                    onClick={() => selectIncoming(m.challenge.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      panel === 'incoming' && activeIncomingId === m.challenge.id
                        ? 'border-rhip-teal bg-rhip-lightTeal'
                        : 'border-gray-100 hover:border-rhip-teal/30'
                    }`}
                  >
                    <p className="font-medium text-rhip-dark text-sm">{m.challenge.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-rhip-cardBg rounded-full text-rhip-muted">
                        {Math.round(m.score * 100)}% match
                      </span>
                      <span className="text-xs text-rhip-muted">
                        {m.challenge.posted_by?.name}
                      </span>
                    </div>
                  </button>
                ))}
                {incomingMatches.length === 0 && (
                  <p className="text-sm text-rhip-muted">
                    No matches yet. When someone posts a challenge that fits your profile,
                    you&apos;ll be notified here.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl p-6 shadow-sm min-h-[400px]">
            {panel === 'incoming' && (
              <>
                {!activeIncoming && (
                  <div className="flex items-center justify-center h-64 text-rhip-muted text-center px-4">
                    {incomingMatches.length > 0
                      ? 'Select a match to view the challenge'
                      : 'Incoming AI matches will appear here'}
                  </div>
                )}
                {activeIncoming && <IncomingMatchDetail match={activeIncoming} />}
              </>
            )}

            {panel === 'posted' && (
              <>
                {!activePostedId && (
                  <div className="flex items-center justify-center h-64 text-rhip-muted text-center px-4">
                    Post a challenge or select one to see AI-matched collaborators
                  </div>
                )}
                {activePostedId && (status === 'pending' || status === 'matching') && (
                  <div className="flex flex-col items-center justify-center h-64">
                    <div className="w-12 h-12 border-4 border-rhip-teal border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-rhip-teal font-medium">Searching precinct profiles…</p>
                    <p className="text-sm text-rhip-muted mt-2">Finding the best matches</p>
                  </div>
                )}
                {activePostedId && status === 'matched' && (
                  <div>
                    <h2 className="font-semibold text-rhip-dark mb-6">Top 3 Matches</h2>
                    <div className="space-y-4">
                      {matches.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          challengeId={activePostedId}
                          sent={sentMatches.has(m.id)}
                          onSend={handleSend}
                        />
                      ))}
                      {matches.length === 0 && (
                        <div className="text-center py-10 px-4">
                          <p className="text-sm text-rhip-dark font-medium mb-2">
                            No strong matches found
                          </p>
                          <p className="text-sm text-rhip-muted mb-4">
                            We won&apos;t force weak results. Try a capability ask with a clear role
                            (e.g. biostatistician), or browse people by identity on Directory / Map.
                          </p>
                          <div className="flex flex-wrap justify-center gap-3">
                            <a href="/directory?facets=professional_technical" className="text-sm text-rhip-teal hover:underline">
                              Browse professional / technical
                            </a>
                            <a href="/map?lens=role:professional_technical" className="text-sm text-rhip-teal hover:underline">
                              Open Map lens
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
