/** Only allow same-origin in-app paths after login. */
export function safeRedirectPath(path) {
  if (!path || typeof path !== 'string') return '/dashboard'
  if (!path.startsWith('/') || path.startsWith('//')) return '/dashboard'
  return path
}
