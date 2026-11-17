// Rules shared by the family, sports and class modes. Pure functions, no I/O.
// The database re-checks everything (migrations_016_family_team.sql); this file only guides the form.

export const GROUP_KINDS = ['family', 'sports', 'class']
export const SEX_VALUES = ['female', 'male', 'other']
// Declarations are required for these functions (docs/FAMILY_TEAM.md, section 14.5).
export const SENSITIVE_FUNCTIONS = ['sex', 'ai']
// Age of digital consent used for the rules (16 in both Europe and the United States, see section 13).
export const CONSENT_AGE = 16

export function isGroupKind(kind) {
  return GROUP_KINDS.includes(kind)
}

// Normalises a name the same way the database does: trimmed, single spaces, lower case.
export function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

// Same rule as name_key() in the database: words sorted, accents and case ignored. Stripe can return the first and
// last name in the other order, so "Said ZEGHIDI" and "ZEGHIDI Said" are the same name.
export function nameKey(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .trim().split(/\s+/).filter(Boolean).sort().join(' ')
}

// True when the typed first and last name match the expected name (order, accents and case ignored).
export function nameMatches(typedFirst, typedLast, expected) {
  const typed = nameKey(`${typedFirst ?? ''} ${typedLast ?? ''}`)
  return typed !== '' && typed === nameKey(expected)
}

// Birth year must be plausible for a managed profile: not before 1990 and not in the future.
export function validBirthYear(year, now = new Date()) {
  const y = Number(year)
  return Number.isInteger(y) && y >= 1990 && y <= now.getUTCFullYear()
}

// Age in whole years from a birth year only (the exact date is never collected).
export function ageFromBirthYear(year, now = new Date()) {
  return now.getUTCFullYear() - Number(year)
}

// Under the age of consent, a responsible adult must sign for the profile.
export function needsResponsibleAdult(year, now = new Date()) {
  return ageFromBirthYear(year, now) < CONSENT_AGE
}

// Functions that need the signed declaration of an adult before they are active.
export function functionsNeedingDeclaration(profile) {
  const out = []
  if (profile?.sex) out.push('sex')
  return out
}

// Pending profiles are removed after this many days if nobody signs (section 14.4).
export const PENDING_RETENTION_DAYS = 30

// Guardian consent by e-mail. Same rule as the database (sign_managed_profile): with only the birth year known,
// the child may be under 13 when the year difference is 13 or less.
export function consentRequired(year, now = new Date()) {
  return now.getUTCFullYear() - Number(year) <= 13
}
