export const BLOCKED_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.com.au', 'yahoo.co.nz',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.com.au',
  'outlook.com', 'live.com', 'live.com.au', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'tutanota.com',
  'aol.com', 'mail.com', 'zoho.com',
]

export function isBlockedEmail(email) {
  if (!email || !email.includes('@')) return false
  const domain = email.split('@').pop().toLowerCase()
  return BLOCKED_DOMAINS.includes(domain)
}

export const BLOCKED_EMAIL_MESSAGE =
  'Personal email addresses are not accepted. Please use your institutional email.'
