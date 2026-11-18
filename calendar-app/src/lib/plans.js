// Display helpers for the plan section and the usage meter. The server decides (supabase/functions/_shared/plans.ts);
// this only explains the situation to the person.

export function monthStartIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

// What the meter shows. plan: { ai_enabled, ai_monthly_requests, ai_per_seat } or null.
export function meterState(plan, status, seats, used) {
  if (!plan || status === 'canceled' || !plan.ai_enabled) return { kind: 'none', used, limit: 0, percent: 0 }
  if (plan.ai_monthly_requests === null || plan.ai_monthly_requests === undefined) return { kind: 'unlimited', used, limit: null, percent: 0 }
  const limit = plan.ai_monthly_requests * (plan.ai_per_seat ? Math.max(1, seats || 1) : 1)
  return { kind: 'limited', used, limit, percent: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100 }
}

// Last day of the refund window: 14 days after the start, 30 for the work plan (same rule as the server).
export function refundDeadline(planCode, startedAtIso) {
  const start = Date.parse(startedAtIso || '')
  if (!Number.isFinite(start)) return null
  return new Date(start + (planCode === 'team_work' ? 30 : 14) * 86400_000)
}
