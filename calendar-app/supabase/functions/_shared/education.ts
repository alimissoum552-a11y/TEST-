// Education price: which school addresses are accepted, pure so it can be tested (docs/PRICING.md, "Education").

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.fr', 'live.com', 'live.fr', 'msn.com', 'yahoo.com', 'yahoo.fr',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.de', 'gmx.net', 'web.de', 'mail.com',
  'orange.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'wanadoo.fr', 'bbox.fr', 'yandex.com', 'zoho.com', 'tutanota.com', 'sapo.pt',
])

export function domainOf(email: string): string {
  return String(email ?? '').trim().toLowerCase().split('@')[1] ?? ''
}

// Personal mailboxes do not prove anything about a school.
export function isFreeMail(email: string): boolean {
  return FREE_MAIL.has(domainOf(email))
}

// Domains that only schools and universities get: approved without a manual check once the address is confirmed.
const SCHOOL_PATTERNS: RegExp[] = [
  /(^|\.)edu$/,                       // United States
  /(^|\.)edu\.[a-z]{2}$/,             // edu.pt, edu.au, edu.es...
  /(^|\.)ac\.[a-z]{2}$/,              // ac.uk, ac.jp...
  /(^|\.)ac-[a-z-]+\.fr$/,            // French académies: ac-paris.fr, ac-lyon.fr...
  /(^|\.)sch\.uk$/,                   // UK schools
  /(^|\.)k12\.[a-z]{2}\.us$/,         // US public schools
  /(^|\.)educa\.[a-z.]+$/,            // educa.madrid.org, educa.jcyl.es...
  /(^|\.)schule\.[a-z.]+$/,           // German school networks
  /(^|\.)min-edu\.pt$/,
]

export function isSchoolDomain(email: string): boolean {
  const d = domainOf(email)
  return !!d && SCHOOL_PATTERNS.some((re) => re.test(d))
}

export const EDUCATION_PLANS = ['pro', 'team_groups']
export const EDUCATION_COUPON = 'edu_50'
