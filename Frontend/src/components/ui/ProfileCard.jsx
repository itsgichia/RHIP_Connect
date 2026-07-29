export default function ProfileCard({ profile, onClick }) {
  return (
    <button
      onClick={() => onClick?.(profile)}
      className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-left w-full"
    >
      <div className="w-14 h-14 bg-rhip-lightTeal rounded-full flex items-center justify-center mb-4">
        <span className="text-rhip-teal font-semibold text-lg">
          {profile.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
        </span>
      </div>
      <h3 className="font-semibold text-rhip-dark">{profile.name}</h3>
      <p className="text-sm text-rhip-muted mb-2">{profile.title}</p>
      {profile.institution_name && (
        <p className="text-xs text-rhip-muted mb-3">{profile.institution_name}</p>
      )}
      <span className="inline-block px-2 py-1 bg-rhip-lightTeal text-rhip-teal text-xs rounded-full mb-3">
        {profile.specialty_area}
      </span>
      <div className="flex flex-wrap gap-1 mb-3">
        {(profile.expertise_tags || []).slice(0, 3).map((tag) => (
          <span key={tag} className="px-2 py-0.5 bg-rhip-cardBg text-rhip-body text-xs rounded-full">
            {tag}
          </span>
        ))}
      </div>
      <div className="flex gap-4 text-xs text-rhip-muted">
        <span>{profile.publications} publications</span>
        <span>{profile.active_projects} projects</span>
      </div>
    </button>
  )
}
