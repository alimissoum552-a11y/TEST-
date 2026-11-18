import { supabase } from './supabase.js'

// Fetch the user's default calendar (created automatically by the DB trigger).
export async function getDefaultCalendar(userId) {
  const { data, error } = await supabase
    .from('calendars').select('*').eq('owner_id', userId).eq('is_default', true).maybeSingle()
  if (error) throw error
  return data // null for a minor account, which has no calendar of its own
}

export async function listEvents(calendarId) {
  const { data, error } = await supabase
    .from('events').select('*').eq('calendar_id', calendarId).order('starts_at')
  if (error) throw error
  return data
}

export async function createEvent(ev) {
  const { data, error } = await supabase.from('events').insert(ev).select().single()
  if (error) throw error
  return data
}

export async function updateEvent(id, patch) {
  const { data, error } = await supabase.from('events').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}

// Live updates for events of one calendar. Returns an unsubscribe function.
export function subscribeToEvents(calendarId, onChange) {
  const channel = supabase
    .channel(`events:${calendarId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'events', filter: `calendar_id=eq.${calendarId}` },
      (payload) => onChange(payload))
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ---- Sharing ----
export async function listMembers(calendarId) {
  const { data, error } = await supabase
    .from('calendar_members')
    .select('user_id, role, profiles(display_name, email, handle)')
    .eq('calendar_id', calendarId)
  if (error) throw error
  return data
}

// Sends an invitation. The invitee is NOT a member until they accept.
export async function inviteMember(calendarId, email, role) {
  const { data, error } = await supabase
    .rpc('invite_to_calendar', { cal: calendarId, target_email: email, target_role: role })
  if (error) throw error
  return data // invite id, used in the join link
}

// Invites addressed to the signed-in user, waiting for an answer.
export async function listMyInvites() {
  const { data, error } = await supabase.rpc('my_pending_invites')
  if (error) throw error
  return data || []
}

export async function acceptInvite(inviteId) {
  const { error } = await supabase.rpc('accept_invite', { inv: inviteId })
  if (error) throw error
}

export async function declineInvite(inviteId) {
  const { error } = await supabase.rpc('decline_invite', { inv: inviteId })
  if (error) throw error
}

export async function setMemberRole(calendarId, userId, role) {
  const { error } = await supabase
    .from('calendar_members').update({ role }).eq('calendar_id', calendarId).eq('user_id', userId)
  if (error) throw error
}

export async function removeMember(calendarId, userId) {
  const { error } = await supabase
    .from('calendar_members').delete().eq('calendar_id', calendarId).eq('user_id', userId)
  if (error) throw error
}

// ---- History ----
export async function listHistory(eventId) {
  const { data, error } = await supabase
    .from('event_history').select('*').eq('event_id', eventId)
    .order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data
}

export async function restoreVersion(historyId) {
  const { data, error } = await supabase.rpc('restore_event_version', { history_id: historyId })
  if (error) throw error
  return data
}

// Sends the invitation email via the send-invite Edge Function (Resend, server-side).
export async function sendInviteEmail(calendarId, email, role, inviteId) {
  const { data, error } = await supabase.functions.invoke('send-invite', {
    body: { calendar_id: calendarId, email, role, invite_id: inviteId },
  })
  if (error) throw error
  return data
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles').select('display_name, email').eq('id', userId).single()
  if (error) throw error
  return data
}

// ---- Avatars ----
// Uploads a photo to avatars/<uid>/avatar-<ts>.<ext> and stores its public URL on the profile.
export async function uploadAvatar(userId, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage.from('avatars')
    .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })
  if (upErr) throw upErr
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = data.publicUrl
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
  if (error) throw error
  return url
}

export async function removeAvatar(userId) {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
  if (error) throw error
}

export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles').select('display_name, email, avatar_url, handle, account_type').eq('id', userId).single()
  if (error) throw error
  return data
}

// All calendars the user can access: their own plus those they are a member of.
export async function listAccessibleCalendars(userId) {
  const { data: own, error: e1 } = await supabase
    .from('calendars').select('id, name, owner_id, is_default, kind').eq('owner_id', userId)
  if (e1) throw e1
  const { data: memberships, error: e2 } = await supabase
    .from('calendar_members').select('calendar_id, role').eq('user_id', userId)
  if (e2) throw e2
  const sharedIds = (memberships || []).map((m) => m.calendar_id).filter((id) => !own.some((c) => c.id === id))
  let shared = []
  if (sharedIds.length) {
    const { data, error } = await supabase
      .from('calendars').select('id, name, owner_id, is_default, kind').in('id', sharedIds)
    if (error) throw error
    // Owner names make shared calendars distinguishable when they share a default name.
    const ownerIds = [...new Set(data.map((c) => c.owner_id))]
    let names = {}
    if (ownerIds.length) {
      const { data: profs } = await supabase
        .from('profiles').select('id, display_name, email').in('id', ownerIds)
      names = Object.fromEntries((profs || []).map((p) => [p.id, p.display_name || p.email]))
    }
    shared = data.map((c) => ({
      ...c,
      my_role: memberships.find((m) => m.calendar_id === c.id)?.role,
      owner_name: names[c.owner_id] || null,
    }))
  }
  return [
    ...own.map((c) => ({ ...c, my_role: 'owner' })),
    ...shared,
  ]
}

// Events across several calendars, each tagged with its calendar id.
export async function listEventsForCalendars(calendarIds) {
  if (!calendarIds.length) return []
  const { data, error } = await supabase
    .from('events').select('*').in('calendar_id', calendarIds).order('starts_at')
  if (error) throw error
  return data
}

// Pending invites for a calendar, shown to its owner/administrators.
export async function listCalendarInvites(calendarId) {
  const { data, error } = await supabase
    .from('calendar_invites')
    .select('id, invitee_email, role, status, created_at')
    .eq('calendar_id', calendarId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Cancels a pending invitation. The join link stops working immediately.
export async function cancelInvite(inviteId) {
  const { error } = await supabase.from('calendar_invites').delete().eq('id', inviteId)
  if (error) throw error
}

// ---- Invitation links ----
// The invitee can read an invitation addressed to their e-mail (RLS). Returns null when it is not visible to this account.
export async function getInviteById(inviteId) {
  const { data, error } = await supabase
    .from('calendar_invites')
    .select('id, calendar_id, invitee_email, role, status')
    .eq('id', inviteId)
    .maybeSingle()
  if (error) throw error
  return data ? { ...data, invitee_email: (data.invitee_email || '').toLowerCase() } : null
}

export async function isMemberOf(calendarId, userId) {
  const { data, error } = await supabase
    .from('calendar_members')
    .select('user_id')
    .eq('calendar_id', calendarId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

// ---- AI assistant ----
// Date the signed-in user accepted the assistant policy, or null.
export async function getAiAcceptedAt(userId) {
  const { data, error } = await supabase
    .from('profiles').select('ai_accepted_at').eq('id', userId).maybeSingle()
  if (error) throw error
  return data?.ai_accepted_at ?? null
}

export async function acceptAssistantPolicy(userId) {
  const { error } = await supabase
    .from('profiles').update({ ai_accepted_at: new Date().toISOString() }).eq('id', userId)
  if (error) throw error
}

// Sends the conversation to the assistant Edge Function. Returns { reply, consulted }.
// Errors carry a short code (consent_required, daily_limit, assistant_not_configured, ...).
export async function askAssistant(messages, timezone, locale) {
  const { data, error } = await supabase.functions.invoke('assistant', {
    body: { messages, timezone, locale },
  })
  if (error) {
    let code = 'server_error'
    try { code = (await error.context.json()).error || code } catch { /* no JSON body */ }
    throw new Error(code)
  }
  return data
}

// ---- Team chat ----
// Latest messages of a calendar, oldest first.
export async function listMessages(calendarId) {
  const { data, error } = await supabase
    .from('messages').select('id, calendar_id, user_id, content, created_at, is_ai')
    .eq('calendar_id', calendarId).order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return (data || []).reverse()
}

export async function sendMessage(calendarId, userId, content) {
  const { data, error } = await supabase
    .from('messages').insert({ calendar_id: calendarId, user_id: userId, content })
    .select('id, calendar_id, user_id, content, created_at, is_ai').single()
  if (error) throw error
  return data
}

export async function deleteMessage(messageId) {
  const { error } = await supabase.from('messages').delete().eq('id', messageId)
  if (error) throw error
}

// Display names for message authors (readable by members of the same calendar).
export async function getNamesByIds(ids) {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('profiles').select('id, display_name, email, handle').in('id', ids)
  if (error) throw error
  return data || []
}

// ---- AI in the team chat ----
// Whether the AI is switched on for this calendar's chat. Readable by members.
export async function getChatAi(calendarId) {
  const { data, error } = await supabase
    .from('calendars').select('chat_ai_enabled').eq('id', calendarId).maybeSingle()
  if (error) throw error
  return Boolean(data?.chat_ai_enabled)
}

// Owner only: enforced by the calendars_own row policy. Other roles update nothing.
export async function setChatAi(calendarId, enabled) {
  const { data, error } = await supabase
    .from('calendars').update({ chat_ai_enabled: enabled }).eq('id', calendarId).select('chat_ai_enabled')
  if (error) throw error
  if (!data?.length) throw new Error('not_allowed')
  return Boolean(data[0].chat_ai_enabled)
}

// Asks the AI to answer the latest chat message that mentions it. The reply arrives as a chat message (Realtime).
export async function askChatAi(calendarId) {
  const { data, error } = await supabase.functions.invoke('chat-ai', { body: { calendar_id: calendarId } })
  if (error) {
    let code = 'server_error'
    try { code = (await error.context.json()).error || code } catch { /* no JSON body */ }
    throw new Error(code)
  }
  return data
}

export async function getChatNotes(calendarId) {
  const { data, error } = await supabase
    .from('chat_ai_notes').select('content, updated_at').eq('calendar_id', calendarId).maybeSingle()
  if (error) throw error
  return data
}

// ---- Connected apps (OAuth grants) ----
export async function listMyGrants() {
  const { data, error } = await supabase.auth.oauth.listGrants()
  if (error) throw error
  return data || []
}

export async function revokeMyGrant(clientId) {
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId })
  if (error) throw error
}

// ---- Handles and mentions ----
// Sets the signed-in user's handle. Returns { ok } or { error: 'handleTaken' | 'handleInvalid' }.
export async function setMyHandle(userId, handle) {
  const clean = String(handle || '').trim().toLowerCase().replace(/^@/, '')
  if (!/^[a-z0-9_]{3,20}$/.test(clean) || ['ai', 'ia', 'ki'].includes(clean)) return { error: 'handleInvalid' }
  const { error } = await supabase.from('profiles').update({ handle: clean }).eq('id', userId)
  if (error) {
    if (error.code === '23505') return { error: 'handleTaken' }
    if (error.code === '23514') return { error: 'handleInvalid' }
    throw error
  }
  return { ok: true, handle: clean }
}

// The signed-in user's notifications, newest first.
export async function listNotifications() {
  const { data, error } = await supabase
    .from('notifications').select('id, calendar_id, actor_id, created_at, read_at')
    .order('created_at', { ascending: false }).limit(30)
  if (error) throw error
  return data || []
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  if (error) throw error
}

// Calls onInsert for every new notification addressed to this user (Realtime, RLS-filtered). Returns an unsubscribe.
export function subscribeNotifications(userId, onInsert) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onInsert(payload.new))
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export async function markNotificationRead(id) {
  const { error } = await supabase
    .from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
  if (error) throw error
}

// ---- AI permissions (per user, opt-in; everything is off by default) ----
export async function getAiPermissions(userId) {
  const { data, error } = await supabase
    .from('ai_permissions').select('can_create, can_update, can_delete').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data || { can_create: false, can_update: false, can_delete: false }
}

export async function setAiPermissions(userId, patch) {
  const { error } = await supabase.from('ai_permissions')
    .upsert({ user_id: userId, updated_at: new Date().toISOString(), ...patch })
  if (error) throw error
}

// ---- Well-being (personal settings are owner-only; team settings are written by the calendar owner only) ----
export async function getWellbeingSettings(userId) {
  const { data, error } = await supabase.from('wellbeing_settings').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data || null
}

export async function saveWellbeingSettings(userId, patch) {
  const { data, error } = await supabase
    .from('wellbeing_settings').upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('*').single()
  if (error) throw error
  return data
}

export async function getTeamWellbeing(calendarId) {
  const { data, error } = await supabase.from('team_wellbeing').select('*').eq('calendar_id', calendarId).maybeSingle()
  if (error) throw error
  return data || null
}

// Owner only: the row policy refuses any other user, so a refused write returns no row.
export async function saveTeamWellbeing(calendarId, userId, patch) {
  const { data, error } = await supabase
    .from('team_wellbeing')
    .upsert({ calendar_id: calendarId, ...patch, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'calendar_id' })
    .select('*')
  if (error) throw error
  if (!data?.length) throw new Error('not_allowed')
  return data[0]
}

// A member can leave their own messages out of the team analysis (row exists = excluded).
export async function getMyWellbeingOptout(calendarId, userId) {
  const { data, error } = await supabase.from('team_wellbeing_optout').select('calendar_id')
    .eq('calendar_id', calendarId).eq('user_id', userId).maybeSingle()
  if (error) throw error
  return !!data
}

export async function setMyWellbeingOptout(calendarId, userId, excluded) {
  if (excluded) {
    const { error } = await supabase.from('team_wellbeing_optout').upsert({ calendar_id: calendarId, user_id: userId }, { onConflict: 'calendar_id,user_id' })
    if (error) throw error
  } else {
    const { error } = await supabase.from('team_wellbeing_optout').delete().eq('calendar_id', calendarId).eq('user_id', userId)
    if (error) throw error
  }
}

// Private well-being alerts: only the person concerned can read or mark them.
export async function listMyWellbeingAlerts(userId) {
  const { data, error } = await supabase.from('wellbeing_alerts').select('id, calendar_id, kind, created_at, read_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  if (error) throw error
  return data ?? []
}

export async function markWellbeingAlertRead(id) {
  const { error } = await supabase.from('wellbeing_alerts').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

// Owner only (RLS): counts and sources of recent team analyses. Never message text.
export async function getWellbeingAnalysisLog(calendarId, limit = 10) {
  const { data, error } = await supabase.from('wellbeing_analysis_log')
    .select('ran_at, sources, messages_read, load_days, crisis_alerts, posted')
    .eq('calendar_id', calendarId).order('ran_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data ?? []
}

// ---- Family, sports team and class modes (docs/FAMILY_TEAM.md) ----
export async function getIdentityStatus(userId) {
  const { data, error } = await supabase.from('identity_verifications').select('status, verified_name')
    .eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data || { status: 'none' }
}

// Returns the Stripe-hosted page to open, or the status when already verified.
export async function startIdentityVerification() {
  const { data, error } = await supabase.functions.invoke('identity', { body: { action: 'start' } })
  if (error) {
    let code = 'server_error'
    let detail = null
    try {
      const body = await error.context.json()
      code = body.error || code
      detail = body.stripe_error?.message || null
    } catch { /* no JSON body */ }
    const ex = new Error(code)
    ex.detail = detail
    throw ex
  }
  return data
}

export async function setCalendarKind(calendarId, kind) {
  const { data, error } = await supabase.from('calendars').update({ kind }).eq('id', calendarId).select('kind')
  if (error) throw error
  return data?.[0]?.kind ?? kind
}

export async function listManagedProfiles(calendarId) {
  const { data, error } = await supabase.from('managed_profiles')
    .select('id, first_name, birth_year, sex, category, status, created_at, activated_at, consent_status, guardian_email, auth_user_id, access_disabled')
    .eq('calendar_id', calendarId).neq('status', 'removed').order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addManagedProfile(calendarId, userId, { first_name, birth_year, sex, category }) {
  const { data, error } = await supabase.from('managed_profiles')
    .insert({ calendar_id: calendarId, added_by: userId, first_name, birth_year, sex: sex || null, category: category || null, status: 'pending' })
    .select('id, first_name, birth_year, sex, category, status, created_at, activated_at').single()
  if (error) throw error
  return data
}

// The adult types their first and last name; the database compares them and stores the declaration.
export async function signManagedProfile(profileId, { first, last, functions, version }) {
  const { data, error } = await supabase.rpc('sign_managed_profile', {
    p_profile: profileId, p_first: first, p_last: last, p_functions: functions, p_version: version,
  })
  if (error) throw error
  return data
}

// Owner adds a second adult responsible for a managed profile, by the e-mail of their account.
export async function addGuardianByEmail(profileId, email) {
  const { error } = await supabase.rpc('add_guardian_by_email', { p_profile: profileId, p_email: email })
  if (error) throw error
}

// Reads again the verified name at Stripe for a verified account whose name was not stored (identity function).
export async function refreshIdentityStatus() {
  const { data, error } = await supabase.functions.invoke('identity', { body: { action: 'refresh' } })
  if (error) {
    let code = 'server_error'
    try { code = (await error.context.json()).error || code } catch { /* no JSON body */ }
    throw new Error(code)
  }
  return data
}

// Display name of the account. Other adults sign declarations with it (it must match their identity document).
export async function updateMyName(userId, name) {
  const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', userId)
  if (error) throw error
}

// ---- Team calendars, minor access and guardian consent (docs/MINOR_APP.md) ----
// Calls an Edge Function and throws Error(code) with the function's error code.
async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let code = 'server_error'
    try { code = (await error.context.json()).error || code } catch { /* no JSON body */ }
    throw new Error(code)
  }
  return data
}

// A new calendar dedicated to a family, a sports team or a class. The database requires a verified creator.
export async function createTeamCalendar(userId, name, kind) {
  const { data, error } = await supabase.from('calendars')
    .insert({ owner_id: userId, name, kind, is_default: false }).select('id, name, kind').single()
  if (error) throw error
  return data
}

export const requestMinorConsent = (profileId, guardianEmail) =>
  callFunction('minor-consent', { action: 'request', profile_id: profileId, guardian_email: guardianEmail })
export const getConsentInfo = (token) => callFunction('minor-consent', { action: 'info', token })
export const approveConsent = (token) => callFunction('minor-consent', { action: 'approve', token })

export const createMinorAccess = (profileId) => callFunction('minor-access', { action: 'create', profile_id: profileId })
export const regenerateMinorAccess = (profileId) => callFunction('minor-access', { action: 'regenerate', profile_id: profileId })
export const disableMinorAccess = (profileId) => callFunction('minor-access', { action: 'disable', profile_id: profileId })
// At 16: the minor's access becomes the teenager's own adult account (same account, chat and calendar kept).
export const graduateMinor = (profileId, email, role) =>
  callFunction('minor-access', { action: 'graduate', profile_id: profileId, email, role, confirm_age: true })

// The minor gives the e-mail of the team owner and the identifier; the function answers with a token that opens a session.
export async function minorLogin(email, id) {
  const res = await callFunction('minor-access', { action: 'login', email, id })
  const { error } = await supabase.auth.verifyOtp({ token_hash: res.token_hash, type: 'magiclink' })
  if (error) throw new Error('session_failed')
  return res
}

// Names for the chat, without e-mail addresses (works for adults and for minors).
export async function getTeamDirectory(calendarId) {
  const { data, error } = await supabase.rpc('team_member_names', { p_calendar: calendarId })
  if (error) throw error
  return data || []
}

// Owner-only, done on the server so the technical accounts of minors are deleted too (team-admin function).
export const removeManagedProfile = (profileId) => callFunction('team-admin', { action: 'remove_profile', profile_id: profileId })
export const deleteCalendar = (calendarId) => callFunction('team-admin', { action: 'delete_calendar', calendar_id: calendarId })

// Deletes the caller's own account and everything attached to it. The e-mail address typed by the user is the confirmation.
export const deleteMyAccount = (confirmEmail) => callFunction('delete-account', { confirm_email: confirmEmail })

// Paid plans (Stripe Billing, function `billing`). Both return a Stripe URL to open in the same tab.
// Not wired to a button yet: billing is closed until the launch (docs/PRICING.md).
export const startCheckout = (plan, interval, seats) => callFunction('billing', { action: 'checkout', plan, interval, seats })
export const openBillingPortal = () => callFunction('billing', { action: 'portal' })
// Within 14 days of the start (30 for work teams): refund and end the subscription now.
export const requestRefund = () => callFunction('billing', { action: 'refund' })

// The caller's own subscription with the plan it points to (RLS: a user reads only their own row).
export async function getMySubscription(userId) {
  const { data: sub, error } = await supabase.from('subscriptions')
    .select('plan_code, status, source, seats, current_period_end, cancel_at, started_at, stripe_customer_id').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!sub) return null
  const { data: plan, error: pErr } = await supabase.from('plans')
    .select('code, ai_enabled, ai_monthly_requests, ai_per_seat').eq('code', sub.plan_code).maybeSingle()
  if (pErr) throw pErr
  return { ...sub, plan }
}

// AI requests counted on this account since the start of the UTC month (requests made in its calendars included).
export async function countMyAiUsageThisMonth(userId, sinceIso) {
  const { count, error } = await supabase.from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('billed_to', userId).gte('created_at', sinceIso)
  if (error) throw error
  return count ?? 0
}

// The owner names an adult responsible by e-mail. The server links the account (or stores an invitation) and sends an e-mail.
export const inviteGuardian = (profileId, email) =>
  callFunction('minor-consent', { action: 'invite_guardian', profile_id: profileId, email })
