import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// The session id is a claim of the JWT that Supabase already validated for this request.
export function sessionIdFromRequest(req: Request): string | null {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
    ))
    return typeof payload.session_id === 'string' ? payload.session_id : null
  } catch { return null }
}

// Privileged actions reached through a service-role function do not go through RLS, so they must
// ask the question themselves: does this session carry a live passkey step-up? Accounts without a
// passkey are unaffected. Any doubt (missing claim, failed query) is a refusal.
export async function stepUpSatisfied(db: SupabaseClient, req: Request, userId: string): Promise<boolean> {
  const { data: keys, error } = await db.from('webauthn_credentials').select('id').eq('user_id', userId).limit(1)
  if (error) return false
  if (!keys?.length) return true
  const sessionId = sessionIdFromRequest(req)
  if (!sessionId) return false
  const { data, error: stepupError } = await db.from('passkey_stepups').select('session_id')
    .eq('session_id', sessionId).eq('user_id', userId).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (stepupError) return false
  return Boolean(data)
}
