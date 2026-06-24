import { useState } from 'react'

export default function MatchCard({ match, onSend, sent }) {
  const [message, setMessage] = useState('')
  const profile = match.profile
  const pct = Math.round(match.score * 100)

  if (sent) {
    return (
      <div className="bg-rhip-lightTeal rounded-2xl p-6 border border-rhip-teal/20">
        <p className="text-rhip-teal font-medium text-center">Connection request sent</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          match.rank === 1 ? 'bg-rhip-teal text-white' : 'bg-rhip-cardBg text-rhip-body'
        }`}>
          {match.rank === 1 ? 'Best Match' : `#${match.rank}`}
        </span>
        <div className="flex-1">
          <h4 className="font-semibold text-rhip-dark">{profile?.name}</h4>
          <p className="text-sm text-rhip-muted">{profile?.title}</p>
          {profile?.institution_name && (
            <p className="text-xs text-rhip-muted">{profile.institution_name}</p>
          )}
        </div>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-xs text-rhip-muted mb-1">
          <span>Match score</span>
          <span>{pct}% match</span>
        </div>
        <div className="h-2 bg-rhip-cardBg rounded-full overflow-hidden">
          <div
            className="h-full bg-rhip-teal rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <p className="text-sm italic text-rhip-muted mb-4">{match.reasoning}</p>
      <div className="flex flex-wrap gap-1 mb-4">
        {(profile?.expertise_tags || []).slice(0, 3).map((tag) => (
          <span key={tag} className="px-2 py-0.5 bg-rhip-lightTeal text-rhip-teal text-xs rounded-full">
            {tag}
          </span>
        ))}
      </div>
      <hr className="border-gray-100 mb-4" />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Introduce yourself and explain what you're looking for..."
        rows={3}
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal mb-3"
      />
      <button
        onClick={() => onSend?.(match.id, message)}
        disabled={!message.trim()}
        className="w-full py-2 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam transition-colors disabled:opacity-50"
      >
        Send
      </button>
    </div>
  )
}
