// Founder accounts (Supabase secret ADMIN_USER_IDS, comma-separated user ids): campaign tools in the MCP connector and
// switching their own plan without payment, to test what each plan gives (docs/PRICING.md, "Admin accounts").
export function adminIds(raw: string | undefined | null): string[] {
  return String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}
export function isAdminId(userId: string, raw: string | undefined | null): boolean {
  return !!userId && adminIds(raw).includes(userId)
}
// Plans an admin may switch to directly: every plan of the grid, and back to the launch plan.
export const ADMIN_SWITCH_PLANS = ['launch', 'free', 'starter', 'pro', 'team_groups', 'team_work']
