import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Reads the session id from a JWT payload. This is a decode, not a validation: only use it on a
// token whose signature the auth server has already checked (see stepUpSatisfied).
export function sessionIdFromToken(token: string): string | null {
  const part = String(token || '').split('.')[1]
  if (!part) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
    ))
    // Never fall back to sub/user_id: another identifier must not open the step-up.
    return typeof payload.session_id === 'string' && payload.session_id ? payload.session_id : null
  } catch { return null }
}

export function bearerToken(req: Request): string | null {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  return token || null
}

export function sessionIdFromRequest(req: Request): string | null {
  const token = bearerToken(req)
  return token ? sessionIdFromToken(token) : null
}

// Privileged actions reached through a service-role function do not go through RLS, so they must
// ask the question themselves: does this session carry a live passkey step-up? Accounts without a
// passkey are unaffected. Any doubt (missing claim, failed query) is a refusal.
export async function stepUpSatisfied(db: SupabaseClient, req: Request, userId: string): Promise<boolean> {
  const { data: keys, error } = await db.from('webauthn_credentials').select('id').eq('user_id', userId).limit(1)
  if (error) return false
  if (!keys?.length) return true

  // Validate the token with the auth server before trusting any of its claims. This makes the
  // helper safe even if a caller forgets to authenticate first, and it cannot be fooled by a
  // token that merely decodes.
  const token = bearerToken(req)
  if (!token) return false
  const { data: auth, error: authError } = await db.auth.getUser(token)
  if (authError || !auth?.user || auth.user.id !== userId) return false

  const sessionId = sessionIdFromToken(token)
  if (!sessionId) return false
  const { data, error: stepupError } = await db.from('passkey_stepups').select('session_id')
    .eq('session_id', sessionId).eq('user_id', userId).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (stepupError) return false
  return Boolean(data)
}
