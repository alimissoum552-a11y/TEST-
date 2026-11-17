// Pure helpers of the minor access: identifier generation, normalisation, hashing, login attempt limits.
// No database or network here, so everything can be tested.

// Crockford base32: digits and letters without I, L, O and U, so an identifier is easy to read out and type.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const ID_LENGTH = 12 // 12 characters x 5 bits = 60 bits

// 256 is a multiple of 32, so taking a byte modulo 32 is unbiased.
export function generateAccessId(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(ID_LENGTH))): string {
  let out = ''
  for (let i = 0; i < ID_LENGTH; i++) out += ALPHABET[bytes[i] % 32]
  return out
}

// Shown to the adult as XXXX-XXXX-XXXX.
export function formatAccessId(id: string): string {
  return id.match(/.{1,4}/g)?.join('-') ?? id
}

// What the minor types: any case, spaces or dashes, and the usual look-alike letters (I, L, O).
export function normalizeAccessId(input: unknown): string {
  return String(input ?? '').toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0')
}

export function isValidAccessIdShape(id: string): boolean {
  return id.length === ID_LENGTH && [...id].every((c) => ALPHABET.includes(c))
}

// Only this hash is stored. The secret keeps the hashes useless to anyone who reads the table.
export async function hmacHex(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Login attempts: after too many failures for one identifier or one address, the next attempts are refused for a while.
export const WINDOW_MINUTES = 15
export const MAX_FAILS_PER_ID = 5
export const MAX_FAILS_PER_ADDRESS = 20

export function tooManyAttempts(failsForId: number, failsForAddress: number): boolean {
  return failsForId >= MAX_FAILS_PER_ID || failsForAddress >= MAX_FAILS_PER_ADDRESS
}

// Same rule as the database (sign_managed_profile): when only the birth year is known, the child may be under 13
// if the year difference is 13 or less.
export function consentRequired(birthYear: number, now: Date = new Date()): boolean {
  return now.getUTCFullYear() - birthYear <= 13
}

// Shown to the guardian to recognise the team owner without exposing the address: s***@gmail.com.
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return ''
  return `${local[0]}***@${domain}`
}

export function validEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}
