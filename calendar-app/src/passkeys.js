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
  // select() returns the deleted rows: RLS silently deletes nothing without a step-up, and the
  // user must not be told the passkey is gone when it is still there.
  const { data, error } = await supabase.from('webauthn_credentials').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('stepup_required')
}

export async function signInWithPasskey(email) {
  const { options, challengeToken } = await invoke('auth-options', { email })
  const response = await startAuthentication({ optionsJSON: options })
  const { token_hash, stepup_claim } = await invoke('auth-verify', { response, challengeToken })
  const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
  if (error) throw error
  // Bind the verified assertion to the new session. The claim is issued by the server and can be
  // redeemed once; the browser cannot create one.
  if (stepup_claim) await invoke('stepup-claim', { claim: stepup_claim })
}

// Server truth: does this session already carry a valid passkey step-up?
export async function getStepupStatus() {
  return await invoke('stepup-status')
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

export async function removeAllPasskeys(userId) {
  const { data, error } = await supabase.from('webauthn_credentials').delete().eq('user_id', userId).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('stepup_required')
}

// OAuth consent: the passkey proof is tied to the client and its scopes, then stored server-side.
export async function grantMcp(clientId, scopes) {
  const { options, challengeToken } = await invoke('stepup-options')
  const response = await startAuthentication({ optionsJSON: options })
  await invoke('grant-mcp', { client_id: clientId, scopes, challengeToken, response })
}

export async function revokeMcpGrant(clientId) {
  // Errors are surfaced on purpose: a connector must never look disconnected while it still works.
  return await invoke('revoke-mcp', { client_id: clientId })
}

// Collyo's grant is revoked first: that is what gates the data. The OAuth grant at Supabase is
// revoked second. A failure of the second step is reported, not hidden.
export async function revokeConnector(clientId, { revokeGrant, revokeOauth } = {}) {
  const grant = revokeGrant || revokeMcpGrant
  const oauth = revokeOauth || (async (id) => {
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId: id })
    if (error) throw error
  })
  await grant(clientId)
  try {
    await oauth(clientId)
    return { grantRevoked: true, oauthRevoked: true }
  } catch (error) {
    return { grantRevoked: true, oauthRevoked: false, error }
  }
}
