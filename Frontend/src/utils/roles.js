export const ROLES = {
  ADMIN: 'admin',
  CLINICIAN: 'clinician',
  RESEARCHER: 'researcher',
  INDUSTRY: 'industry',
  INVESTOR: 'investor',
}

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.CLINICIAN]: 'Clinician',
  [ROLES.RESEARCHER]: 'Researcher',
  [ROLES.INDUSTRY]: 'Industry Partner',
  [ROLES.INVESTOR]: 'Investor',
}

export function canPostChallenge(role) {
  return [ROLES.ADMIN, ROLES.CLINICIAN, ROLES.RESEARCHER].includes(role)
}

export function canViewDirectory(role) {
  return [ROLES.ADMIN, ROLES.CLINICIAN, ROLES.RESEARCHER, ROLES.INDUSTRY].includes(role)
}

export function canPostProject(role) {
  return [ROLES.ADMIN, ROLES.RESEARCHER].includes(role)
}

export function isAdmin(role) {
  return role === ROLES.ADMIN
}

export function getNavLinks(role) {
  const links = [{ path: '/dashboard', label: 'Dashboard' }]
  if (canViewDirectory(role)) links.push({ path: '/directory', label: 'Directory' })
  if (canPostChallenge(role) || role === ROLES.INDUSTRY) {
    links.push({ path: '/challenges', label: 'Challenges' })
  }
  if ([ROLES.ADMIN, ROLES.CLINICIAN, ROLES.RESEARCHER, ROLES.INDUSTRY].includes(role)) {
    links.push({ path: '/pipeline', label: 'Pipeline' })
  }
  if ([ROLES.ADMIN, ROLES.CLINICIAN, ROLES.RESEARCHER].includes(role)) {
    links.push({ path: '/passport', label: 'Passport' })
  }
  if (isAdmin(role)) links.push({ path: '/admin', label: 'Admin' })
  return links
}
