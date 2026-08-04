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

/** Multiselect identity facets on Profile */
export const IDENTITY_FACETS = {
  CLINICIAN: 'clinician',
  RESEARCHER: 'researcher',
  PROFESSIONAL_TECHNICAL: 'professional_technical',
  POLICY: 'policy',
}

export const IDENTITY_FACET_LABELS = {
  [IDENTITY_FACETS.CLINICIAN]: 'Clinician',
  [IDENTITY_FACETS.RESEARCHER]: 'Researcher',
  [IDENTITY_FACETS.PROFESSIONAL_TECHNICAL]: 'Professional / technical',
  [IDENTITY_FACETS.POLICY]: 'Policy',
}

export const CAREER_LEVELS = {
  STUDENT: 'student',
  ECR: 'ecr',
  MID: 'mid',
  SENIOR: 'senior',
  EXECUTIVE: 'executive',
}

export const CAREER_LEVEL_LABELS = {
  [CAREER_LEVELS.STUDENT]: 'Postgraduate student',
  [CAREER_LEVELS.ECR]: 'Early career',
  [CAREER_LEVELS.MID]: 'Mid career',
  [CAREER_LEVELS.SENIOR]: 'Senior',
  [CAREER_LEVELS.EXECUTIVE]: 'Executive',
}

export function hasFacet(facets, facet) {
  return (facets || []).includes(facet)
}

export function facetLabel(facet) {
  return IDENTITY_FACET_LABELS[facet] || ROLE_LABELS[facet] || facet
}

export function canPostChallenge(role) {
  return [ROLES.ADMIN, ROLES.CLINICIAN, ROLES.RESEARCHER].includes(role)
}

/** @deprecated Use canPostChallenge — posting is open to clinician, researcher, and admin. */
export function canPostClinicalChallenge(role) {
  return canPostChallenge(role)
}

export function isResearcher(role) {
  return role === ROLES.RESEARCHER
}

export function canViewDirectory(role) {
  return [ROLES.ADMIN, ROLES.CLINICIAN, ROLES.RESEARCHER, ROLES.INDUSTRY].includes(role)
}

export function canViewMap(role) {
  return [
    ROLES.ADMIN,
    ROLES.CLINICIAN,
    ROLES.RESEARCHER,
    ROLES.INDUSTRY,
  ].includes(role)
}

export function canPostProject(role) {
  return [ROLES.ADMIN, ROLES.RESEARCHER].includes(role)
}

export function isAdmin(role) {
  return role === ROLES.ADMIN
}

export function isInvestor(role) {
  return role === ROLES.INVESTOR
}

export function isIndustry(role) {
  return role === ROLES.INDUSTRY
}

/** Investors and industry partners use an account-style profile, not the research directory layout. */
export function isCommercialPartner(role) {
  return role === ROLES.INVESTOR || role === ROLES.INDUSTRY
}

/** Innovation Pipeline is for commercial / investment audiences (+ admin). */
export function canViewPipeline(role) {
  return [ROLES.ADMIN, ROLES.INDUSTRY, ROLES.INVESTOR].includes(role)
}

export function canInitiateChat(role) {
  return [ROLES.ADMIN, ROLES.CLINICIAN, ROLES.RESEARCHER].includes(role)
}

/**
 * CPD / MyCPD export on Passport.
 * Visible to admins, clinician access role, and anyone with a clinician identity facet
 * (including dual clinician + researcher profiles).
 */
export function canViewCpd(role, identityFacets = []) {
  if ([ROLES.ADMIN, ROLES.CLINICIAN].includes(role)) return true
  if (
    hasFacet(identityFacets, IDENTITY_FACETS.CLINICIAN) &&
    hasFacet(identityFacets, IDENTITY_FACETS.RESEARCHER)
  ) {
    return true
  }
  return hasFacet(identityFacets, IDENTITY_FACETS.CLINICIAN)
}

export function getNavLinks(role) {
  if (isAdmin(role)) {
    return [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/map', label: 'Map' },
      { path: '/pipeline', label: 'Pipeline' },
      { path: '/messages', label: 'Messages' },
      { path: '/admin', label: 'Admin Panel' },
    ]
  }

  const links = [{ path: '/dashboard', label: 'Dashboard' }]
  if (isInvestor(role)) {
    links.push({ path: '/investor', label: 'Investor Portal' })
    if (canViewPipeline(role)) links.push({ path: '/pipeline', label: 'Pipeline' })
    if (canViewMap(role)) links.push({ path: '/map', label: 'Map' })
    return links
  }
  if (canViewDirectory(role)) links.push({ path: '/directory', label: 'Directory' })
  if (canViewMap(role)) links.push({ path: '/map', label: 'Map' })
  if (canPostChallenge(role)) {
    links.push({ path: '/challenges', label: 'Challenges' })
  }
  if (canInitiateChat(role)) {
    links.push({ path: '/messages', label: 'Messages' })
  }
  if (canViewPipeline(role)) {
    links.push({ path: '/pipeline', label: 'Pipeline' })
  }
  if ([ROLES.ADMIN, ROLES.CLINICIAN, ROLES.RESEARCHER].includes(role)) {
    links.push({ path: '/passport', label: 'Passport' })
  }
  return links
}
