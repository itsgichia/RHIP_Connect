import { useCallback, useEffect, useState } from 'react'
import api from '../hooks/useApi'
import ProjectCard from '../components/ui/ProjectCard'

const STAGES = [
  { num: 1, label: 'Need' },
  { num: 2, label: 'Idea' },
  { num: 3, label: 'PoC' },
  { num: 4, label: 'Feasibility' },
  { num: 5, label: 'Proof of Value' },
  { num: 6, label: 'Initial Trials' },
  { num: 7, label: 'Validation' },
  { num: 8, label: 'Approval' },
  { num: 9, label: 'Clinical Use' },
  { num: 10, label: 'Standard of Care' },
]

const SPECIALTIES = [
  { key: 'all', label: 'All' },
  { key: 'Mental Health', label: 'Mental Health' },
  { key: 'Personalised Medicine', label: 'Personalised Medicine' },
  { key: 'Rare Diseases', label: 'Rare Diseases' },
  { key: 'Health Systems', label: 'Health Systems' },
]

export default function PipelinePage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState(null)
  const [specialty, setSpecialty] = useState('all')

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (stage) params.set('stage', String(stage))
      const { data } = await api.get(`/pipeline/projects?${params}`)
      let list = data.projects
      if (specialty !== 'all') {
        list = list.filter((p) => p.specialty_area.includes(specialty))
      }
      setProjects(list)
    } finally {
      setLoading(false)
    }
  }, [stage, specialty])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-2">Innovation Pipeline</h1>
      <p className="text-rhip-muted mb-6">
        Track research projects from clinical need through to standard of care.
      </p>

      <div className="mb-4 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          <button
            type="button"
            onClick={() => setStage(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              stage === null
                ? 'bg-rhip-teal text-white'
                : 'bg-white text-rhip-body border border-gray-200 hover:border-rhip-teal/40'
            }`}
          >
            All stages
          </button>
          {STAGES.map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStage(s.num)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                stage === s.num
                  ? 'bg-rhip-teal text-white'
                  : 'bg-white text-rhip-body border border-gray-200 hover:border-rhip-teal/40'
              }`}
            >
              {s.num} {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {SPECIALTIES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSpecialty(s.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              specialty === s.key
                ? 'bg-rhip-navy text-white'
                : 'bg-white text-rhip-body border border-gray-200 hover:border-rhip-teal/40'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-rhip-muted">Loading projects…</p>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          {projects.length === 0 && (
            <p className="text-rhip-muted col-span-full text-center py-12">
              No projects match the selected filters.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
