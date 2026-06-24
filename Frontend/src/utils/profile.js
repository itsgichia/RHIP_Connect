const HONORIFIC_PATTERN = /^(Prof\.?|A\/Prof\.?|Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i

export function parseProfileName(fullName) {
  const match = fullName.match(HONORIFIC_PATTERN)
  if (!match) {
    return { honorific: null, displayName: fullName }
  }
  const honorific = match[1].replace(/\.$/, '')
  const displayName = fullName.slice(match[0].length).trim()
  return { honorific, displayName }
}

export function profileInitials(name) {
  const { displayName } = parseProfileName(name)
  return displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
