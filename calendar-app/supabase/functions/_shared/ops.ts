// Operations monitoring (docs/OPERATIONS.md, "Monitoring"): unexpected errors are written to `ops_errors`, and the
// `ops-alert` job e-mails a digest. Messages are scrubbed: no e-mail address, token, key or card number is stored.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { scrub } from './scrub.ts'

export { scrub }

// Never throws: monitoring must not break the request it observes.
export async function reportError(source: string, err: unknown, detail: Record<string, unknown> = {}): Promise<void> {
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const e = err as any
    await admin.from('ops_errors').insert({
      source,
      code: scrub(e?.code ?? e?.name ?? 'error', 60),
      message: scrub(e?.message ?? e),
      detail: Object.fromEntries(Object.entries(detail).slice(0, 10).map(([k, v]) => [k, scrub(typeof v === 'string' ? v : JSON.stringify(v), 200)])),
    })
  } catch { /* ignore */ }
}
