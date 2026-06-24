import { Link } from 'react-router-dom'
import { ChevronRightIcon } from '@heroicons/react/24/outline'

export default function ServiceCard({ service }) {
  return (
    <Link
      to={`/community/services/${service.slug}`}
      className="group block bg-white border border-gray-100 rounded-2xl p-6 hover:border-rhip-teal/30 hover:shadow-md transition-all h-full"
    >
      <span className="inline-block px-2.5 py-0.5 bg-rhip-lightTeal text-rhip-teal text-xs rounded-full mb-3">
        {service.specialty}
      </span>
      <h3 className="font-display text-xl font-semibold text-rhip-dark group-hover:text-rhip-teal transition-colors mb-2">
        {service.name}
      </h3>
      <p className="text-sm text-rhip-body leading-relaxed mb-4 line-clamp-3">{service.summary}</p>
      <div className="text-xs text-rhip-muted space-y-1 mb-4">
        <p>{service.facility_name}</p>
        {service.contact_phone && <p>{service.contact_phone}</p>}
      </div>
      <span className="inline-flex items-center gap-1 text-sm text-rhip-teal font-medium">
        View service details
        <ChevronRightIcon className="w-4 h-4" />
      </span>
    </Link>
  )
}
