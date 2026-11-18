// Plans and AI quota (docs/PRICING.md). The AI follows the calendar: the owner's plan pays for requests made in
// their calendar; the personal assistant is paid by the caller. The checks run on the server only.

export type Plan = {
  code: string
  ai_enabled: boolean
  ai_monthly_requests: number | null // null = no monthly limit
  ai_per_seat: boolean
}

export type AiVerdict =
  | { ok: true; limit: number | null }
  | { ok: false; error: 'plan_required' | 'quota_reached'; limit: number | null }

// Pure decision, so it can be tested: may this account make one more AI request this month?
export function aiVerdict(plan: Plan | null, status: string | null, seats: number, usedThisMonth: number): AiVerdict {
  // No plan row, or a canceled subscription, counts as the free plan: no AI.
  if (!plan || status === 'canceled' || !plan.ai_enabled) return { ok: false, error: 'plan_required', limit: 0 }
  if (plan.ai_monthly_requests === null) return { ok: true, limit: null }
  const limit = plan.ai_monthly_requests * (plan.ai_per_seat ? Math.max(1, seats) : 1)
  return usedThisMonth >= limit ? { ok: false, error: 'quota_reached', limit } : { ok: true, limit }
}

export function startOfMonthUtc(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

// Reads the subscription and this month's usage with the service role, then decides.
export async function checkAiQuota(admin: any, billedTo: string): Promise<AiVerdict> {
  const { data: sub } = await admin.from('subscriptions').select('plan_code, status, seats').eq('user_id', billedTo).maybeSingle()
  // An account with no subscription row (it should not happen) is treated as the plan new accounts get.
  const code = sub?.plan_code ?? 'launch'
  const { data: plan } = await admin.from('plans')
    .select('code, ai_enabled, ai_monthly_requests, ai_per_seat').eq('code', code).maybeSingle()
  const { count } = await admin.from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('billed_to', billedTo).gte('created_at', startOfMonthUtc())
  return aiVerdict(plan ?? null, sub?.status ?? 'active', sub?.seats ?? 1, count ?? 0)
}
