// Campaign tools for the founder (docs/GROWTH.md, "Running a campaign from Claude"). Listed and callable only when the
// signed-in account is in ADMIN_USER_IDS (Supabase secret, comma-separated user ids). Every other account sees the
// normal read-only calendar tools. Data returned is aggregated, except education requests, which support must review.
// Secrets used: ADMIN_USER_IDS, BILLING_MODE, STRIPE_BILLING_LIVE_API_KEY / STRIPE_BILLING_API_KEY, CRON_SECRET.

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
const COUPON = 'founder_club_6m'

export function isAdmin(userId: string): boolean {
  return (Deno.env.get('ADMIN_USER_IDS') ?? '').split(',').map((s) => s.trim()).filter(Boolean).includes(userId)
}

export const ADMIN_TOOLS = [
  {
    name: 'campaign_metrics',
    description: 'Collyo growth numbers by week of sign-up: sign-ups, activated (made an event and shared within 7 days), came back (active between day 7 and 14), active people in the last 7 days, shared calendars with 3+ people, paying subscriptions and monthly revenue at list price. Founder test accounts are left out. Counts only.',
    inputSchema: { type: 'object', properties: { weeks: { type: 'integer', minimum: 1, maximum: 26 } }, additionalProperties: false },
    annotations: { title: 'Campaign metrics (weekly)', ...READ },
  },
  {
    name: 'campaign_daily',
    description: 'Day-by-day numbers for a running campaign: sign-ups, shared calendars created, invitations sent, events created, new paid subscriptions. Counts only.',
    inputSchema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 90 } }, additionalProperties: false },
    annotations: { title: 'Campaign metrics (daily)', ...READ },
  },
  {
    name: 'plans_and_prices',
    description: 'The Collyo plans with prices (EUR, cents), AI quota and limits, plus the offers: founding club (Team groups free for 6 months with a code) and education (50 % off Pro and Team groups for verified teachers).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Plans and prices', ...READ },
  },
  {
    name: 'list_founder_codes',
    description: 'Founding-club promotion codes already made: code, club, used or not, active, expiry.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'List founding-club codes', ...READ },
  },
  {
    name: 'create_founder_code',
    description: 'Make a founding-club code for one club: Team (groups) free for 6 months, single use, valid 60 days. The club enters it on the Stripe payment page. Set confirm to true only after the founder agreed to give this club the offer.',
    inputSchema: {
      type: 'object',
      properties: { club_name: { type: 'string', minLength: 2, maxLength: 80 }, confirm: { type: 'boolean' } },
      required: ['club_name', 'confirm'],
      additionalProperties: false,
    },
    annotations: { title: 'Create a founding-club code', ...WRITE },
  },
  {
    name: 'list_education_requests',
    description: 'Teacher requests for the education price that wait for a manual check (school domain not on the known list): user id, school, school e-mail, country, date.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Education requests to check', ...READ },
  },
  {
    name: 'decide_education_request',
    description: 'Approve or reject a teacher request under review. The teacher receives an e-mail. Only after the school was checked.',
    inputSchema: {
      type: 'object',
      properties: { user_id: { type: 'string' }, approve: { type: 'boolean' }, note: { type: 'string', maxLength: 200 } },
      required: ['user_id', 'approve'],
      additionalProperties: false,
    },
    annotations: { title: 'Decide an education request', ...WRITE },
  },
]

function stripeKey(): string {
  return Deno.env.get(Deno.env.get('BILLING_MODE') === 'live' ? 'STRIPE_BILLING_LIVE_API_KEY' : 'STRIPE_BILLING_API_KEY') ?? ''
}
async function stripe(path: string, params?: Record<string, string>, method = 'GET'): Promise<any> {
  const body = params ? new URLSearchParams(params).toString() : undefined
  const res = await fetch(`https://api.stripe.com/v1${path}${method === 'GET' && body ? `?${body}` : ''}`, {
    method, headers: { Authorization: `Bearer ${stripeKey()}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: method === 'POST' ? body : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? 'stripe_error')
  return data
}

export async function runAdminTool(name: string, input: any, admin: any): Promise<unknown> {
  if (name === 'campaign_metrics') {
    const { data, error } = await admin.rpc('growth_report', { p_weeks: Number(input.weeks) || 8 })
    if (error) throw error
    return data
  }
  if (name === 'campaign_daily') {
    const { data, error } = await admin.rpc('growth_daily', { p_days: Number(input.days) || 14 })
    if (error) throw error
    return data
  }
  if (name === 'plans_and_prices') {
    const { data, error } = await admin.from('plans')
      .select('code, name, price_month_cents, price_year_cents, price_includes_tax, ai_enabled, ai_monthly_requests, ai_per_seat, max_shared_calendars, max_members_per_calendar, min_seats, team_wellbeing')
      .neq('code', 'launch').order('sort')
    if (error) throw error
    return { plans: data, offers: { founding_club: 'Team (groups) free for 6 months, one single-use code per club (create_founder_code)', education: '50 % off Pro and Team (groups) for teachers who confirmed a school address' }, pricing_page: 'https://collyo.app/#/pricing' }
  }
  if (name === 'list_founder_codes') {
    const list = await stripe('/promotion_codes', { limit: '100' })
    return (list.data ?? []).filter((p: any) => p.metadata?.offer === 'founding_club').map((p: any) => ({
      code: p.code, club: p.metadata?.club ?? null, used: p.times_redeemed > 0, active: p.active,
      expires: p.expires_at ? new Date(p.expires_at * 1000).toISOString().slice(0, 10) : null,
    }))
  }
  if (name === 'create_founder_code') {
    if (input.confirm !== true) return { error: 'Set confirm to true once the founder agreed to give this club the offer.' }
    const club = String(input.club_name ?? '').trim().slice(0, 80)
    if (club.length < 2) return { error: 'club_name is required' }
    const slug = club.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12) || 'CLUB'
    const suffix = Array.from(crypto.getRandomValues(new Uint8Array(3))).map((b) => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('')
    const expires = Math.floor(Date.now() / 1000) + 60 * 86400
    const promo = await stripe('/promotion_codes', {
      'promotion[type]': 'coupon', 'promotion[coupon]': COUPON, code: `CLUB-${slug}-${suffix}`, max_redemptions: '1',
      expires_at: String(expires), 'metadata[club]': club, 'metadata[offer]': 'founding_club',
    }, 'POST')
    return { code: promo.code, club, valid_until: new Date(expires * 1000).toISOString().slice(0, 10), how: 'The club creates its account, chooses Team (groups) on https://collyo.app/#/pricing and enters the code on the payment page.' }
  }
  if (name === 'list_education_requests') {
    const { data, error } = await admin.from('education_requests')
      .select('user_id, school_name, school_email, country, confirmed_at').eq('status', 'review').order('confirmed_at')
    if (error) throw error
    return data
  }
  if (name === 'decide_education_request') {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/education`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '' },
      body: JSON.stringify({ action: 'decide', user_id: String(input.user_id ?? ''), approve: input.approve === true, note: input.note ?? null }),
    })
    return await res.json()
  }
  return { error: `unknown tool ${name}` }
}
