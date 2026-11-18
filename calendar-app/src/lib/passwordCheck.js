// Password rules for sign-up and password changes (docs/OPERATIONS.md, "Accounts and passwords").
// Supabase checks the minimum length on the server; leaked-password checks need its Pro plan, so the app asks
// Have I Been Pwned itself with k-anonymity: only the first 5 characters of the SHA-1 hash leave the browser.
export const MIN_PASSWORD_LENGTH = 10

export async function sha1Hex(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// true when the password appears in a known breach. Unreachable service: false (the check never blocks a sign-up).
export async function isPwned(password, fetchImpl = (...a) => fetch(...a), timeoutMs = 3000) {
  try {
    const hash = await sha1Hex(password)
    const prefix = hash.slice(0, 5), suffix = hash.slice(5)
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true' }, signal: ctrl?.signal })
    if (timer) clearTimeout(timer)
    if (!res.ok) return false
    const body = await res.text()
    return body.split('\n').some((line) => {
      const [s, count] = line.trim().split(':')
      return s === suffix && Number(count) > 0
    })
  } catch {
    return false
  }
}

// The message key to show, or null when the password is acceptable.
export async function passwordProblem(password, fetchImpl) {
  if (String(password ?? '').length < MIN_PASSWORD_LENGTH) return 'passwordTooShort'
  if (await isPwned(password, fetchImpl)) return 'passwordPwned'
  return null
}
