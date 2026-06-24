import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../hooks/useApi'

const EMPTY_SERVICE = {
  name: '',
  summary: '',
  description: '',
  specialty: '',
  contact_phone: '',
  contact_email: '',
  contact_address: '',
  referral_info: '',
  facility_id: '',
  is_public: true,
}

const EMPTY_SPECIALIST = {
  name: '',
  title: '',
  specialties: '',
  department: '',
  phone: '',
  address: '',
  email: '',
  bio: '',
  clinic_hours: '',
  languages: '',
  accepting_referrals: true,
  facility_id: '',
  service_id: '',
  is_public: true,
}

function ServicesPanel({ facilities, onRefresh }) {
  const [services, setServices] = useState([])
  const [form, setForm] = useState(EMPTY_SERVICE)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await api.get('/admin/community/services')
    setServices(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.summary.trim() || !form.specialty.trim() || !form.facility_id) return
    setSaving(true)
    try {
      await api.post('/admin/community/services', form)
      toast.success('Service created')
      setForm({ ...EMPTY_SERVICE, facility_id: facilities[0]?.id || '' })
      await load()
      onRefresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create service')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (service) => {
    setSaving(true)
    try {
      await api.patch(`/admin/community/services/${service.id}`, {
        name: service.name,
        summary: service.summary,
        specialty: service.specialty,
        contact_phone: service.contact_phone,
        contact_email: service.contact_email,
        is_public: service.is_public,
      })
      toast.success('Service updated')
      setEditing(null)
      await load()
      onRefresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update service')
    } finally {
      setSaving(false)
    }
  }

  const handleHide = async (id) => {
    if (!window.confirm('Hide this service from the public directory?')) return
    try {
      await api.delete(`/admin/community/services/${id}`)
      toast.success('Service hidden')
      await load()
      onRefresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to hide service')
    }
  }

  useEffect(() => {
    if (facilities.length && !form.facility_id) {
      setForm((f) => ({ ...f, facility_id: facilities[0].id }))
    }
  }, [facilities, form.facility_id])

  const inputClass =
    'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal'

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-semibold text-rhip-dark mb-4">Add Clinical Service</h3>
        <form onSubmit={handleCreate} className="grid md:grid-cols-2 gap-4">
          <input placeholder="Service name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
          <input placeholder="Specialty" value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} className={inputClass} />
          <input placeholder="Summary" value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} className={`md:col-span-2 ${inputClass}`} />
          <select value={form.facility_id} onChange={(e) => setForm((f) => ({ ...f, facility_id: e.target.value }))} className={inputClass}>
            <option value="">Select facility</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <input placeholder="Contact phone" value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} className={inputClass} />
          <button type="submit" disabled={saving} className="md:col-span-2 px-5 py-2 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Service'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-rhip-muted">
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Specialty</th>
              <th className="px-6 py-4 font-medium">Facility</th>
              <th className="px-6 py-4 font-medium">Public</th>
              <th className="px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b border-gray-50">
                {editing === s.id ? (
                  <>
                    <td className="px-6 py-4">
                      <input value={s.name} onChange={(e) => setServices((prev) => prev.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x))} className={inputClass} />
                    </td>
                    <td className="px-6 py-4">
                      <input value={s.specialty} onChange={(e) => setServices((prev) => prev.map((x) => x.id === s.id ? { ...x, specialty: e.target.value } : x))} className={inputClass} />
                    </td>
                    <td className="px-6 py-4 text-rhip-muted">{s.facility_name}</td>
                    <td className="px-6 py-4">
                      <input type="checkbox" checked={s.is_public} onChange={(e) => setServices((prev) => prev.map((x) => x.id === s.id ? { ...x, is_public: e.target.checked } : x))} />
                    </td>
                    <td className="px-6 py-4 space-x-2">
                      <button type="button" onClick={() => handleUpdate(services.find((x) => x.id === s.id))} className="text-rhip-teal hover:underline">Save</button>
                      <button type="button" onClick={() => setEditing(null)} className="text-rhip-muted hover:underline">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 font-medium text-rhip-dark">{s.name}</td>
                    <td className="px-6 py-4">{s.specialty}</td>
                    <td className="px-6 py-4 text-rhip-muted">{s.facility_name}</td>
                    <td className="px-6 py-4">{s.is_public ? 'Yes' : 'Hidden'}</td>
                    <td className="px-6 py-4 space-x-3">
                      <button type="button" onClick={() => setEditing(s.id)} className="text-rhip-teal hover:underline">Edit</button>
                      {s.is_public && (
                        <button type="button" onClick={() => handleHide(s.id)} className="text-red-600 hover:underline">Hide</button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {services.length === 0 && <p className="px-6 py-8 text-center text-rhip-muted">No services yet.</p>}
      </div>
    </div>
  )
}

function SpecialistsPanel({ facilities, serviceOptions, onRefresh }) {
  const [specialists, setSpecialists] = useState([])
  const [form, setForm] = useState(EMPTY_SPECIALIST)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await api.get('/admin/community/specialists')
    setSpecialists(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.facility_id) return
    setSaving(true)
    try {
      await api.post('/admin/community/specialists', {
        ...form,
        specialties: form.specialties.split(',').map((s) => s.trim()).filter(Boolean),
        languages: form.languages.split(',').map((s) => s.trim()).filter(Boolean),
        service_id: form.service_id || null,
      })
      toast.success('Specialist created')
      setForm({ ...EMPTY_SPECIALIST, facility_id: facilities[0]?.id || '' })
      await load()
      onRefresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create specialist')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (specialist) => {
    setSaving(true)
    try {
      await api.patch(`/admin/community/specialists/${specialist.id}`, {
        name: specialist.name,
        title: specialist.title,
        department: specialist.department,
        phone: specialist.phone,
        bio: specialist.bio,
        is_public: specialist.is_public,
      })
      toast.success('Specialist updated')
      setEditing(null)
      await load()
      onRefresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update specialist')
    } finally {
      setSaving(false)
    }
  }

  const handleHide = async (id) => {
    if (!window.confirm('Hide this specialist from the public directory?')) return
    try {
      await api.delete(`/admin/community/specialists/${id}`)
      toast.success('Specialist hidden')
      await load()
      onRefresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to hide specialist')
    }
  }

  useEffect(() => {
    if (facilities.length && !form.facility_id) {
      setForm((f) => ({ ...f, facility_id: facilities[0].id }))
    }
  }, [facilities, form.facility_id])

  const inputClass =
    'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal'

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-semibold text-rhip-dark mb-4">Add Specialist</h3>
        <form onSubmit={handleCreate} className="grid md:grid-cols-2 gap-4">
          <input placeholder="Full name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
          <input placeholder="Title (e.g. Consultant)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputClass} />
          <input placeholder="Specialties (comma-separated)" value={form.specialties} onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))} className={inputClass} />
          <input placeholder="Department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} className={inputClass} />
          <select value={form.facility_id} onChange={(e) => setForm((f) => ({ ...f, facility_id: e.target.value }))} className={inputClass}>
            <option value="">Select facility</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <select value={form.service_id} onChange={(e) => setForm((f) => ({ ...f, service_id: e.target.value }))} className={inputClass}>
            <option value="">Link to service (optional)</option>
            {serviceOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
          <textarea placeholder="Bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={3} className={`md:col-span-2 ${inputClass}`} />
          <button type="submit" disabled={saving} className="md:col-span-2 px-5 py-2 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Specialist'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-rhip-muted">
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Department</th>
              <th className="px-6 py-4 font-medium">Facility</th>
              <th className="px-6 py-4 font-medium">Public</th>
              <th className="px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {specialists.map((s) => (
              <tr key={s.id} className="border-b border-gray-50 align-top">
                {editing === s.id ? (
                  <>
                    <td className="px-6 py-4 space-y-2">
                      <input value={s.name} onChange={(e) => setSpecialists((prev) => prev.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x))} className={inputClass} />
                      <input value={s.title} onChange={(e) => setSpecialists((prev) => prev.map((x) => x.id === s.id ? { ...x, title: e.target.value } : x))} className={inputClass} placeholder="Title" />
                    </td>
                    <td className="px-6 py-4">
                      <input value={s.department} onChange={(e) => setSpecialists((prev) => prev.map((x) => x.id === s.id ? { ...x, department: e.target.value } : x))} className={inputClass} />
                      <textarea value={s.bio} onChange={(e) => setSpecialists((prev) => prev.map((x) => x.id === s.id ? { ...x, bio: e.target.value } : x))} rows={2} className={`mt-2 ${inputClass}`} />
                    </td>
                    <td className="px-6 py-4 text-rhip-muted">{s.facility_name}</td>
                    <td className="px-6 py-4">
                      <input type="checkbox" checked={s.is_public} onChange={(e) => setSpecialists((prev) => prev.map((x) => x.id === s.id ? { ...x, is_public: e.target.checked } : x))} />
                    </td>
                    <td className="px-6 py-4 space-x-2">
                      <button type="button" onClick={() => handleUpdate(specialists.find((x) => x.id === s.id))} className="text-rhip-teal hover:underline">Save</button>
                      <button type="button" onClick={() => setEditing(null)} className="text-rhip-muted hover:underline">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4">
                      <p className="font-medium text-rhip-dark">{s.name}</p>
                      <p className="text-xs text-rhip-muted">{s.title}</p>
                    </td>
                    <td className="px-6 py-4">{s.department || '—'}</td>
                    <td className="px-6 py-4 text-rhip-muted">{s.facility_name}</td>
                    <td className="px-6 py-4">{s.is_public ? 'Yes' : 'Hidden'}</td>
                    <td className="px-6 py-4 space-x-3">
                      <button type="button" onClick={() => setEditing(s.id)} className="text-rhip-teal hover:underline">Edit</button>
                      {s.is_public && (
                        <button type="button" onClick={() => handleHide(s.id)} className="text-red-600 hover:underline">Hide</button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {specialists.length === 0 && <p className="px-6 py-8 text-center text-rhip-muted">No specialists yet.</p>}
      </div>
    </div>
  )
}

export default function CommunityAdminTab() {
  const [subTab, setSubTab] = useState('services')
  const [facilities, setFacilities] = useState([])
  const [serviceOptions, setServiceOptions] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    Promise.all([
      api.get('/admin/community/facilities'),
      api.get('/admin/community/service-options'),
    ]).then(([facRes, svcRes]) => {
      setFacilities(facRes.data)
      setServiceOptions(svcRes.data)
    })
  }, [refreshKey])

  const refresh = () => setRefreshKey((k) => k + 1)

  return (
    <div>
      <p className="text-sm text-rhip-muted mb-4">
        Manage public clinical services and specialist directory content shown on the Community portal.
      </p>
      <div className="flex gap-2 mb-6">
        {['services', 'specialists'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize ${
              subTab === key ? 'bg-rhip-dark text-white' : 'bg-white text-rhip-muted hover:text-rhip-dark'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
      {subTab === 'services' ? (
        <ServicesPanel facilities={facilities} onRefresh={refresh} />
      ) : (
        <SpecialistsPanel facilities={facilities} serviceOptions={serviceOptions} onRefresh={refresh} />
      )}
    </div>
  )
}
