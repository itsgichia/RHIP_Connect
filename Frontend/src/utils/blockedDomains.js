export const BLOCKED_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'hotmail.com', 
  'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'mail.com', 'zoho.com',
]

export function isBlockedEmail(email) {
  if (!email || !email.includes('@')) return false
  const domain = email.split('@').pop().toLowerCase()
  return BLOCKED_DOMAINS.includes(domain)
}

export const BLOCKED_EMAIL_MESSAGE =
  'Personal email addresses are not accepted. Please use your institutional email.'
