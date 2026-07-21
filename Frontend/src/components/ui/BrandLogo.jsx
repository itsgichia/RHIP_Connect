export default function BrandLogo({ variant = 'dark', className = '' }) {
  const textColor = variant === 'light' ? 'text-white' : 'text-rhip-dark'
  const markBg = 'bg-rhip-teal'

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${markBg} w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      </div>
      <span className={`font-display font-bold text-lg ${textColor}`}>RHIP Connect</span>
    </div>
  )
}
