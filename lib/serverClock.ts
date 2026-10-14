import { supabase } from './supabase'
import { withTimeout } from './withTimeout'

// A phone with a wrong clock breaks QR validation (30-min buckets) and
// records a wrong check-in time / lateness. This keeps a server-minus-phone
// offset (public.server_now() RPC) so check-in logic can use server time
// without touching lib/istDate.ts globally.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const RESYNC_AFTER_MS = 10 * 60 * 1000
const SKEW_WARN_MS = 2 * 60 * 1000

let offsetMs = 0
let lastSyncAt = 0
let everSynced = false

export async function syncServerClock(force = false): Promise<void> {
  if (!force && everSynced && Date.now() - lastSyncAt < RESYNC_AFTER_MS) return
  try {
    const t0 = Date.now()
    const { data, error } = await withTimeout(supabase.rpc('server_now'), 5000, 'Server clock')
    const t1 = Date.now()
    if (error || !data) return
    const serverMs = Date.parse(String(data))
    if (!Number.isFinite(serverMs)) return
    offsetMs = serverMs - (t0 + t1) / 2
    lastSyncAt = t1
    everSynced = true
  } catch {
    // Offline / slow: keep the previous offset (0 on first run) — never block check-in on this.
  }
}

export const serverNowMs = (): number => Date.now() + offsetMs

/** Server-corrected equivalent of istNow() — read with getUTC* methods only. */
export const serverIstNow = (): Date => new Date(serverNowMs() + IST_OFFSET_MS)

// Same 06:45-IST rollover as attendanceDateStr() in lib/istDate.ts (Shift 3
// belongs to the previous working day), but on server time.
export const serverAttendanceDateStr = (): string =>
  new Date(serverNowMs() + (5.5 - 6.75) * 60 * 60 * 1000).toISOString().slice(0, 10)

// Mirrors lateMinutesAgainst() in lib/istDate.ts on server time.
export const serverLateMinutesAgainst = (startTime: string): number => {
  const [h, m] = startTime.split(':').map(Number)
  const now = serverIstNow()
  const diff = (now.getUTCHours() * 60 + now.getUTCMinutes() - (h * 60 + m) + 1440) % 1440
  return diff > 720 ? 0 : diff
}

const hhmm = (d: Date) =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

export const serverIstHHMM = (): string => hhmm(serverIstNow())

/** Non-null only when the phone clock differs from the server by more than 2 min. */
export function clockSkewInfo(): { phone: string; actual: string } | null {
  if (!everSynced || Math.abs(offsetMs) <= SKEW_WARN_MS) return null
  return { phone: hhmm(new Date(Date.now() + IST_OFFSET_MS)), actual: serverIstHHMM() }
}
