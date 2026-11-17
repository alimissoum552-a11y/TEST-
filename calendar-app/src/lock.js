// Local passcode lock for this device. Nothing is sent to the server: the PIN is
// hashed (SHA-256, random salt) and stored in localStorage on this browser only.
// This is a convenience lock, not a replacement for signing out on a shared device.
const KEY = 'calendar-app.lock'

export function readLock() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}

export function isLockEnabled() {
  return Boolean(readLock()?.hash)
}

export function pinValid(pin) {
  return /^\d{4,8}$/.test(String(pin || ''))
}

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function setPasscode(pin) {
  const salt = crypto.randomUUID()
  const hash = await hashPin(pin, salt)
  localStorage.setItem(KEY, JSON.stringify({ v: 1, salt, hash, at: new Date().toISOString() }))
}

export async function verifyPasscode(pin) {
  const lock = readLock()
  if (!lock?.hash) return true
  return (await hashPin(pin, lock.salt)) === lock.hash
}

export function clearPasscode() {
  localStorage.removeItem(KEY)
}
