// Passkeys as a sign-in method (WebAuthn). One function, four actions:
//   register-options / register-verify : signed in with the user's JWT
//   auth-options / auth-verify         : signed out (the point is to sign in)
// Challenges are signed (HMAC) instead of stored, and expire after 5 minutes.
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from 'npm:@simplewebauthn/server@11'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  signToken as signChallenge, readToken as readChallenge, b64url, fromB64url,
} from '../_shared/webauthn-token.ts'
import { sessionIdFromRequest } from '../_shared/stepup.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const origin = () => { try { return new URL(Deno.env.get('APP_URL') ?? 'https://collyo.app').origin } catch { return 'https://collyo.app' } }
const rpID = () => new URL(origin()).hostname
const enc = new TextEncoder()

const secret = (): string => {
  const value = Deno.env.get('WEBAUTHN_SECRET')
  if (!value) throw new Error('missing secret')
  return value
}
const STEPUP_MS = 12 * 3600_000 // one session, renewed by a new passkey check at the next sign-in
const signToken = (payload: Record<string, unknown>) => signChallenge(secret(), payload)

const readToken = (token: string, kind: string) => readChallenge(secret(), token, kind)

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// A challenge may be verified once: the primary key rejects a second use.
async function consumeChallenge(db: SupabaseClient, jti: string): Promise<void> {
  const { error } = await db.from('webauthn_used_challenges').insert({ jti })
  if (error) throw new Error((error as { code?: string }).code === '23505' ? 'challenge_already_used' : 'challenge_store_unavailable')
  // Opportunistic cleanup: the table only needs to remember recent challenges.
  await db.from('webauthn_used_challenges').delete().lt('used_at', new Date(Date.now() - 86400_000).toISOString())
}


// Verifies a user's assertion for the given signed challenge. Used by the step-up and by the
// OAuth consent, so both require exactly the same cryptographic proof.
async function verifyAssertion(
  db: SupabaseClient, userId: string, payload: { c: string; u?: string; j: string }, response: unknown,
): Promise<void> {
  if (payload.u !== userId) throw new Error('not_allowed')
  await consumeChallenge(db, payload.j)
  const credId = String((response as { id?: string } | null)?.id || '')
  const { data: cred } = await db.from('webauthn_credentials')
    .select('*').eq('credential_id', credId).eq('user_id', userId).maybeSingle()
  if (!cred) throw new Error('not_allowed')
  const verification = await verifyAuthenticationResponse({
    response: response as any,
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
  if (!verification.verified) throw new Error('not_allowed')
  await db.from('webauthn_credentials')
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq('id', cred.id)
}

async function signedInUser(req: Request, supa: SupabaseClient) {
  const { data: { user } } = await supa.auth.getUser()
  if (!user) throw new Error('unauthorized')
  // A minor account has no passkeys.
  const { data: me } = await admin().from('profiles').select('account_type').eq('id', user.id).maybeSingle()
  if (me?.account_type === 'minor') throw new Error('not_allowed')
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
      await consumeChallenge(db, payload.j)
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
          timeout: 30_000,
        })
        return json({ options, challengeToken: await signToken({ c: options.challenge, u: user.id, k: 'stepup' }) })
      }

      const payload = await readToken(body.challengeToken, 'stepup')
      await verifyAssertion(db, user.id, payload, body.response)

      const sessionId = sessionIdFromRequest(req)
      if (!sessionId) return json({ error: 'no_session' }, 400)
      const expiresAt = new Date(Date.now() + STEPUP_MS).toISOString()
      const { error: stepupError } = await db.from('passkey_stepups')
        .upsert({ session_id: sessionId, user_id: user.id, expires_at: expiresAt }, { onConflict: 'session_id' })
      if (stepupError) return json({ error: 'stepup_store_unavailable' }, 500)
      return json({ ok: true, expires_at: expiresAt })
    }

    // The session exists: is this browser allowed into the data yet?
    if (action === 'stepup-status') {
      const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      })
      const user = await signedInUser(req, supa)
      const { data: keys } = await db.from('webauthn_credentials').select('id').eq('user_id', user.id).limit(1)
      const required = Boolean(keys?.length)
      if (!required) return json({ required: false, valid: true })
      const sessionId = sessionIdFromRequest(req)
      if (!sessionId) return json({ required: true, valid: false })
      const { data: row } = await db.from('passkey_stepups').select('session_id')
        .eq('session_id', sessionId).eq('user_id', user.id).gt('expires_at', new Date().toISOString()).maybeSingle()
      return json({ required: true, valid: Boolean(row) })
    }

    // A passkey sign-in created a session after the assertion was verified. Redeem the server-side
    // claim once, for that session only; the client cannot forge or replay it.
    if (action === 'stepup-claim') {
      const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      })
      const user = await signedInUser(req, supa)
      const claimId = String(body?.claim || '')
      if (!claimId) return json({ error: 'missing_claim' }, 400)
      const sessionId = sessionIdFromRequest(req)
      if (!sessionId) return json({ error: 'no_session' }, 400)

      const now = new Date().toISOString()
      const { data: used } = await db.from('passkey_stepup_claims')
        .update({ used_at: now })
        .eq('id', claimId).eq('user_id', user.id).is('used_at', null).gt('expires_at', now)
        .select('id').maybeSingle()
      if (!used) return json({ error: 'invalid_claim' }, 403)

      const expiresAt = new Date(Date.now() + STEPUP_MS).toISOString()
      const { error: stepupError } = await db.from('passkey_stepups')
        .upsert({ session_id: sessionId, user_id: user.id, expires_at: expiresAt }, { onConflict: 'session_id' })
      if (stepupError) return json({ error: 'stepup_store_unavailable' }, 500)
      return json({ ok: true, expires_at: expiresAt })
    }

    // Consent of an OAuth connector: the passkey proof is tied to the client and its scopes.
    if (action === 'grant-mcp') {
      const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      })
      const user = await signedInUser(req, supa)
      const clientId = String(body?.client_id || '')
      const scopes = Array.isArray(body?.scopes) ? body.scopes.filter((x: unknown) => typeof x === 'string') : []
      if (!/^[0-9a-f-]{36}$/i.test(clientId) || scopes.length > 20 || scopes.some((x: string) => !/^[a-z:_-]{1,40}$/i.test(x))) {
        return json({ error: 'invalid_request' }, 400)
      }
      const payload = await readToken(body.challengeToken, 'stepup')
      await verifyAssertion(db, user.id, payload, body.response)

      const expiresAt = new Date(Date.now() + 30 * 24 * 3600_000).toISOString()
      const { error } = await db.from('mcp_grants').upsert({
        user_id: user.id, client_id: clientId, scopes, expires_at: expiresAt, revoked_at: null,
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,client_id' })
      if (error) return json({ error: 'grant_store_unavailable' }, 500)

      const sessionId = sessionIdFromRequest(req)
      if (sessionId) {
        await db.from('passkey_stepups').upsert(
          { session_id: sessionId, user_id: user.id, expires_at: new Date(Date.now() + STEPUP_MS).toISOString() },
          { onConflict: 'session_id' },
        )
      }
      return json({ ok: true, expires_at: expiresAt })
    }

    // Revoking a connector: the app also revokes the OAuth grant at Supabase; this kills our grant.
    if (action === 'revoke-mcp') {
      const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      })
      const user = await signedInUser(req, supa)
      const clientId = String(body?.client_id || '')
      if (!clientId) return json({ error: 'missing_client' }, 400)
      const { data: revoked, error: revokeError } = await db.from('mcp_grants')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', user.id).eq('client_id', clientId)
        .select('user_id')
      if (revokeError) return json({ error: 'revoke_failed' }, 500)
      // Zero rows means there was no grant (nothing to revoke), which is a success.
      return json({ ok: true, revoked: revoked?.length ?? 0 })
    }

    // ---- sign-in (no session yet) ----
    if (action === 'auth-options') {
      const email = String(body?.email || '').trim().toLowerCase()
      if (!email) return json({ error: 'invalid_email' }, 400)
      // ilike is case-insensitive but treats % and _ as wildcards: escape them so only an exact address matches.
      const exact = email.replace(/[\\%_]/g, (c) => '\\' + c)
      const { data: profile } = await db.from('profiles').select('id, email').ilike('email', exact).maybeSingle()
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
      await consumeChallenge(db, payload.j)
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

      // The session does not exist yet, so the step-up is bound through a single-use server claim.
      const { data: claim, error: claimError } = await db.from('passkey_stepup_claims')
        .insert({ user_id: payload.u, expires_at: new Date(Date.now() + 5 * 60_000).toISOString() })
        .select('id').single()
      if (claimError || !claim) return json({ error: 'stepup_store_unavailable' }, 500)
      return json({ token_hash: link.properties.hashed_token, stepup_claim: claim.id })
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
