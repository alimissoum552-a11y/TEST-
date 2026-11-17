import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { supabase } from './lib/supabase.js'

// Passkeys are a sign-in method: the device (Face ID, fingerprint, device code)
// proves it belongs to the user, then the server exchanges it for a normal session.
async function invoke(action, body = {}) {
  const { data, error } = await supabase.functions.invoke('webauthn', { body: { action, ...body } })
  if (error) {
    let code = 'server_error'
    try { code = (await error.context.json()).error || code } catch { /* no json */ }
    throw new Error(code)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function listPasskeys(userId) {
  const { data, error } = await supabase.from('webauthn_credentials')
    .select('id, device_label, created_at, last_used_at').eq('user_id', userId).order('created_at')
  if (error) throw error
  return data || []
}

export async function addPasskey(label) {
  const { options, challengeToken } = await invoke('register-options')
  const response = await startRegistration({ optionsJSON: options })
  await invoke('register-verify', { response, challengeToken, label: label || null })
}

export async function removePasskey(id) {
  const { error } = await supabase.from('webauthn_credentials').delete().eq('id', id)
  if (error) throw error
}

export async function signInWithPasskey(email) {
  const { options, challengeToken } = await invoke('auth-options', { email })
  const response = await startAuthentication({ optionsJSON: options })
  const { token_hash } = await invoke('auth-verify', { response, challengeToken })
  const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
  if (error) throw error
}

export async function deviceSupportsPasskey() {
  try {
    return Boolean(window.PublicKeyCredential) &&
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}

// Second factor: the user is already signed in with a password, but the account
// has a passkey, so the app asks the device to confirm before entering.
export async function verifyWithPasskey() {
  const { options, challengeToken } = await invoke('stepup-options')
  const response = await startAuthentication({ optionsJSON: options })
  await invoke('stepup-verify', { response, challengeToken })
}

const VERIFIED_PREFIX = 'calendar-app.passkey-verified:'
export const markPasskeyVerified = (userId) => { try { sessionStorage.setItem(VERIFIED_PREFIX + userId, '1') } catch { /* ignore */ } }
export const isPasskeyVerified = (userId) => { try { return sessionStorage.getItem(VERIFIED_PREFIX + userId) === '1' } catch { return false } }
export const clearPasskeyVerifications = () => {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(VERIFIED_PREFIX)) sessionStorage.removeItem(k)
  } catch { /* ignore */ }
}
