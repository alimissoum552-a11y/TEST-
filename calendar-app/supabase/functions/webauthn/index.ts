// Passkeys as a sign-in method (WebAuthn). One function, four actions:
//   register-options / register-verify : signed in with the user's JWT
//   auth-options / auth-verify         : signed out (the point is to sign in)
// Challenges are signed (HMAC) instead of stored, and expire after 5 minutes.
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from 'npm:@simplewebauthn/server@11'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const MAX_AGE_MS = 5 * 60_000

const origin = () => { try { return new URL(Deno.env.get('APP_URL') ?? 'https://collyo.app').origin } catch { return 'https://collyo.app' } }
const rpID = () => new URL(origin()).hostname

const enc = new TextEncoder()
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('WEBAUTHN_SECRET')
  if (!secret) throw new Error('missing secret')
  return await crypto.subtle.importKey('raw', fromB64url(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

async function signToken(payload: Record<string, unknown>): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...payload, e: Date.now() + MAX_AGE_MS })))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(body))
  return `${body}.${b64url(new Uint8Array(sig))}`
}

async function readToken(token: string, kind: string): Promise<{ c: string; u?: string }> {
  const [body, sig] = String(token || '').split('.')
  if (!body || !sig) throw new Error('bad token')
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(), fromB64url(sig), enc.encode(body))
  if (!ok) throw new Error('bad signature')
  const data = JSON.parse(new TextDecoder().decode(fromB64url(body)))
  if (data.k !== kind) throw new Error('wrong token kind')
  if (!data.e || Date.now() > data.e) throw new Error('expired')
  return { c: data.c, u: data.u }
}

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function signedInUser(req: Request, supa: SupabaseClient) {
  const { data: { user } } = await supa.auth.getUser()
  if (!user) throw new Error('unauthorized')
  return user
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')
    const db = admin()

    // ---- registration (needs a signed-in user) ----
    if (action === 'register-options' || action === 'register-verify') {
      const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      })
      const user = await signedInUser(req, supa)
      const name = user.user_metadata?.display_name || user.email || 'Collyo user'

      if (action === 'register-options') {
        const { data: existing } = await db.from('webauthn_credentials')
          .select('credential_id, transports').eq('user_id', user.id)
        const options = await generateRegistrationOptions({
          rpName: 'Collyo',
          rpID: rpID(),
          userName: user.email ?? name,
          userDisplayName: name,
          userID: enc.encode(user.id),
          attestationType: 'none',
          excludeCredentials: (existing ?? []).map((c: any) => ({ id: c.credential_id, transports: c.transports })),
          authenticatorSelection: {
            residentKey: 'preferred', userVerification: 'required', authenticatorAttachment: 'platform',
          },
        })
        return json({ options, challengeToken: await signToken({ c: options.challenge, u: user.id, k: 'reg' }) })
      }

      const payload = await readToken(body.challengeToken, 'reg')
      if (payload.u !== user.id) return json({ error: 'not_allowed' }, 403)
      const verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: payload.c,
        expectedOrigin: origin(),
        expectedRPID: rpID(),
        requireUserVerification: true,
      })
      if (!verification.verified || !verification.registrationInfo) return json({ error: 'not_verified' }, 400)
      const cred = verification.registrationInfo.credential
      const { error } = await db.from('webauthn_credentials').insert({
        user_id: user.id,
        credential_id: cred.id,
        public_key: b64url(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports ?? [],
        device_label: typeof body.label === 'string' ? body.label.slice(0, 60) : null,
      })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    // ---- step-up: the user is signed in, confirm it is really them before entering ----
    if (action === 'stepup-options' || action === 'stepup-verify') {
      const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      })
      const user = await signedInUser(req, supa)
      const { data: creds } = await db.from('webauthn_credentials')
        .select('credential_id, transports').eq('user_id', user.id)
      if (!creds?.length) return json({ error: 'no_passkey' }, 404)

      if (action === 'stepup-options') {
        const options = await generateAuthenticationOptions({
          rpID: rpID(),
          allowCredentials: creds.map((c: any) => ({ id: c.credential_id, transports: c.transports })),
          userVerification: 'required',
        })
        return json({ options, challengeToken: await signToken({ c: options.challenge, u: user.id, k: 'stepup' }) })
      }

      const payload = await readToken(body.challengeToken, 'stepup')
      if (payload.u !== user.id) return json({ error: 'not_allowed' }, 403)
      const credId = String(body?.response?.id || '')
      const { data: cred } = await db.from('webauthn_credentials')
        .select('*').eq('credential_id', credId).eq('user_id', user.id).maybeSingle()
      if (!cred) return json({ error: 'not_allowed' }, 403)
      const verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: payload.c,
        expectedOrigin: origin(),
        expectedRPID: rpID(),
        requireUserVerification: true,
        credential: {
          id: cred.credential_id,
          publicKey: fromB64url(cred.public_key),
          counter: Number(cred.counter),
          transports: cred.transports ?? [],
        },
      })
      if (!verification.verified) return json({ error: 'not_allowed' }, 403)
      await db.from('webauthn_credentials')
        .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
        .eq('id', cred.id)
      return json({ ok: true })
    }

    // ---- sign-in (no session yet) ----
    if (action === 'auth-options') {
      const email = String(body?.email || '').trim().toLowerCase()
      if (!email) return json({ error: 'invalid_email' }, 400)
      const { data: profile } = await db.from('profiles').select('id, email').ilike('email', email).maybeSingle()
      if (!profile) return json({ error: 'no_passkey' }, 404)
      const { data: creds } = await db.from('webauthn_credentials')
        .select('credential_id, transports').eq('user_id', profile.id)
      if (!creds?.length) return json({ error: 'no_passkey' }, 404)
      const options = await generateAuthenticationOptions({
        rpID: rpID(),
        allowCredentials: creds.map((c: any) => ({ id: c.credential_id, transports: c.transports })),
        userVerification: 'required',
      })
      return json({ options, challengeToken: await signToken({ c: options.challenge, u: profile.id, k: 'auth' }) })
    }

    if (action === 'auth-verify') {
      const payload = await readToken(body.challengeToken, 'auth')
      const credId = String(body?.response?.id || '')
      const { data: cred } = await db.from('webauthn_credentials')
        .select('*').eq('credential_id', credId).eq('user_id', payload.u).maybeSingle()
      if (!cred) return json({ error: 'not_allowed' }, 403)
      const verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: payload.c,
        expectedOrigin: origin(),
        expectedRPID: rpID(),
        requireUserVerification: true,
        credential: {
          id: cred.credential_id,
          publicKey: fromB64url(cred.public_key),
          counter: Number(cred.counter),
          transports: cred.transports ?? [],
        },
      })
      if (!verification.verified) return json({ error: 'not_allowed' }, 403)
      await db.from('webauthn_credentials')
        .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
        .eq('id', cred.id)

      const { data: profile } = await db.from('profiles').select('email').eq('id', payload.u).maybeSingle()
      if (!profile?.email) return json({ error: 'no_email' }, 400)
      // Exchange the verified passkey for a normal Supabase session.
      const { data: link, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: profile.email })
      if (error || !link?.properties?.hashed_token) return json({ error: 'session_failed' }, 500)
      return json({ token_hash: link.properties.hashed_token })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    const message = (e as Error).message || 'server_error'
    if (message === 'unauthorized') return json({ error: 'unauthorized' }, 401)
    return json({ error: message }, 400)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
