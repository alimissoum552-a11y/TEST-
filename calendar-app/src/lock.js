// Device lock for this browser: a WebAuthn platform credential (Face ID, fingerprint,
// Windows Hello, or the phone's own passcode). No second PIN is created and nothing
// is stored on the server. The credential id stays in localStorage on this device only.
const KEY = 'calendar-app.passkey'
const OLD_KEY = 'calendar-app.lock'

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const random = (n = 32) => crypto.getRandomValues(new Uint8Array(n))

export function readLock() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}

export function isLockEnabled() {
  return Boolean(readLock()?.id)
}

export function clearPasskey() {
  localStorage.removeItem(KEY)
  localStorage.removeItem(OLD_KEY)
}

// A PIN lock from an earlier version is dropped: the device check replaces it.
export function migrateOldLock() {
  try { if (localStorage.getItem(OLD_KEY)) localStorage.removeItem(OLD_KEY) } catch { /* ignore */ }
}

export async function supportsDeviceUnlock() {
  try {
    return Boolean(window.PublicKeyCredential) &&
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}

// Asks the device to create a platform credential for this user.
export async function registerPasskey(user) {
  const name = user.name || user.email || 'Collyo user'
  const userId = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(user.id))
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: random(),
      rp: { name: 'Collyo', id: window.location.hostname },
      user: { id: new Uint8Array(userId), name, displayName: name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      attestation: 'none',
      timeout: 60_000,
    },
  })
  if (!credential) throw new Error('cancelled')
  localStorage.setItem(KEY, JSON.stringify({
    v: 2, id: b64url(credential.rawId), at: new Date().toISOString(),
  }))
  localStorage.removeItem(OLD_KEY)
}

// Asks the device to verify its owner. Resolves true only if the ceremony succeeded.
export async function verifyPasskey() {
  const lock = readLock()
  if (!lock?.id) return true
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: random(),
      rpId: window.location.hostname,
      allowCredentials: [{ type: 'public-key', id: fromB64url(lock.id) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })
  return Boolean(assertion)
}
