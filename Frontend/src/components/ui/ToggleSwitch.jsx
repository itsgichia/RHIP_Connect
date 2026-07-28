export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  id,
}) {
  const switchId = id || (label ? `toggle-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)

  return (
    <div className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-60' : ''}`}>
      <div className="min-w-0">
        {label && (
          <p id={switchId ? `${switchId}-label` : undefined} className="text-sm font-medium text-rhip-dark">
            {label}
          </p>
        )}
        {description && (
          <p className="text-xs text-rhip-muted mt-0.5">{description}</p>
        )}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={switchId && label ? `${switchId}-label` : undefined}
        aria-label={!label ? 'Toggle' : undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange?.(!checked)
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rhip-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
          checked ? 'bg-rhip-teal' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
