import { Shift } from '@/types'

// Minutes an employee is assumed to normally arrive ahead of their shift's
// start — Yash's own worked examples (General starts 09:00; 08:45 arrival
// counts as General, not late for Shift 1; 07:45/08:00/08:15/08:30 all count
// as Shift 1, late) fix this at a flat 15 minutes for every shift, including
// General even though General's own `late_grace_minutes` is 30 — those are
// two different things: this buffer decides WHICH shift a check-in belongs
// to; `late_grace_minutes` (read separately, after this) decides whether
// that check-in counts as late once assigned.
const EARLY_ARRIVAL_BUFFER_MINUTES = 15

// Widened early-arrival buffer, used ONLY at a true zero-gap shift handoff
// (today: Shift 3's 07:00 end handing straight into Shift 1/Shift 4's
// 07:00 start) — Yash, 6 Oct 2026: someone arriving 06:00/06:30 for a 7am
// shift was wrongly landing on Shift 3's tail (00:00-07:00, window still
// open until 06:45) and getting flagged ~6h late for a midnight shift he
// was never on. Every other junction (General<->Shift1/2, Shift5's own
// boundaries, Security's pool) keeps the flat 15-min buffer — see
// detectWidenedStartBuffers() below for exactly which boundary qualifies,
// verified against the live shift set before shipping (06 Oct 2026
// boundary-sweep script, not committed — see CLAUDE.md/PENDING.md).
const WIDENED_HANDOFF_BUFFER_MINUTES = 60
const MINUTES_PER_DAY = 1440

const mod = (n: number, m: number) => ((n % m) + m) % m

type ShiftWithStart = { shift: Shift; startMin: number }

// For each shift in `withStart` (already sorted + tie-broken by
// findClosestShift), returns the early-arrival buffer to use for THAT
// shift's own window start: WIDENED_HANDOFF_BUFFER_MINUTES only when its
// immediately-preceding shift (previous distinct start_time, skipping any
// shift that ties its own start) hands off into it with zero gap —
// predecessor.end_time === this shift's start_time — otherwise the normal
// EARLY_ARRIVAL_BUFFER_MINUTES.
//
// This is deliberately generic (no shift names hardcoded) so it keeps
// working if the live shift set changes, but today it resolves to exactly
// one widened junction: Shift 3 (ends 07:00) -> Shift 1 and Shift 4 (both
// start 07:00). Every other pair of adjacent entries in the sorted list —
// including General -> General (Pune) -> Shift 2 -> Shift 5, none of which
// line up end-to-end — keeps the flat 15-minute buffer. Shift 2's end
// (00:00) numerically equals Shift 3's start (00:00) too, but they are NOT
// "immediately preceding" each other in this sorted-by-start-time circular
// list (Shift 5, starting later at 19:00, sits between them going forward
// and wraps around before Shift 3), so that boundary is correctly left
// untouched. Verified against the live shift set with a standalone sweep
// before this was wired in (06 Oct 2026) — see PENDING.md.
function detectWidenedStartBuffers(withStart: ShiftWithStart[]): number[] {
  return withStart.map((entry, i) => {
    let prevIndex = (i - 1 + withStart.length) % withStart.length
    while (withStart[prevIndex].startMin === entry.startMin && prevIndex !== i) {
      prevIndex = (prevIndex - 1 + withStart.length) % withStart.length
    }
    const predecessor = withStart[prevIndex]
    return predecessor.shift.end_time === entry.shift.start_time
      ? WIDENED_HANDOFF_BUFFER_MINUTES
      : EARLY_ARRIVAL_BUFFER_MINUTES
  })
}

// When an employee has no shift allotted for today, each shift "owns" the
// window from (its own start - 15min) up to (the next shift's start - 15min)
// — not whichever shift's start_time is numerically closest. Those two
// methods agree most of the time but disagree right where it matters: at
// 08:15, closest-start-time picks General (45min away) over Shift 1
// (75min away), but a real 08:15 arrival is someone late for the 07:00
// shift, not someone early for the 09:00 one. The window model gets this
// right by construction, and also removes the exact-tie case at 08:00
// (equidistant from both) that closest-start-time could resolve either way.
export function findClosestShift(nowMinutesOfDay: number, role: string | undefined, shifts: Shift[]): Shift | null {
  const isSecurity = role === 'security_guard'
  const filtered = shifts.filter(s => isSecurity ? s.name.startsWith('Security') : !s.name.startsWith('Security'))
  const pool = filtered.length > 0 ? filtered : shifts
  if (pool.length === 0) return null

  const withStart = pool
    .map(s => {
      const [h, m] = s.start_time.split(':').map(Number)
      return Number.isNaN(h) || Number.isNaN(m) ? null : { shift: s, startMin: h * 60 + m }
    })
    .filter((s): s is { shift: Shift; startMin: number } => s !== null)
    // Tiebreak by name when two shifts share a start_time (e.g. Shift 1 and
    // Shift 4 both 07:00) — deterministic across query runs, since Postgres
    // gives no ordering guarantee among equal start_time rows on its own.
    .sort((a, b) => a.startMin - b.startMin || a.shift.name.localeCompare(b.shift.name))

  if (withStart.length === 0) return null
  if (withStart.length === 1) return withStart[0].shift

  // Per-shift start buffer — 60min at the one Shift-3->Shift-1/4 handoff,
  // 15min everywhere else. A window's END uses the BUFFER OF THE SHIFT
  // THAT WINDOW HANDS OFF TO (see windowEnd below), not its own start
  // buffer, so adjacent windows always partition the day with no gap or
  // overlap even where the buffer changes mid-boundary.
  const startBuffer = detectWidenedStartBuffers(withStart)

  for (let i = 0; i < withStart.length; i++) {
    const current = withStart[i]
    // The window's end is the NEXT DISTINCT start_time, not just the next
    // array slot — two shifts sharing a start_time (Shift 1/Shift 4, both
    // 07:00) would otherwise each compute a zero-length gap to the other,
    // which the `|| MINUTES_PER_DAY` fallback below turns into a *full
    // 24-hour* window for whichever of the pair sorts first, silently
    // swallowing every other shift's window for the whole pool. Skipping
    // to the next differing start_time keeps the fallback reserved for the
    // genuine single-shift case it was meant for.
    let nextIndex = (i + 1) % withStart.length
    while (withStart[nextIndex].startMin === current.startMin && nextIndex !== i) {
      nextIndex = (nextIndex + 1) % withStart.length
    }
    const next = withStart[nextIndex]
    const windowStart = current.startMin - startBuffer[i]
    const windowEnd = next.startMin - startBuffer[nextIndex]
    const windowLength = mod(windowEnd - windowStart, MINUTES_PER_DAY) || MINUTES_PER_DAY
    const elapsedSinceWindowStart = mod(nowMinutesOfDay - windowStart, MINUTES_PER_DAY)
    if (elapsedSinceWindowStart < windowLength) return current.shift
  }
  return withStart[withStart.length - 1].shift
}

// How early someone may arrive and still count as on their assigned shift.
// Claude's judgment call, not Yash's number (see CLAUDE.md, 28 Sep 2026).
const ASSIGNED_EARLY_ALLOWANCE_MINUTES = 60

// Yash, 28 Sep 2026: check-in time decides the shift, even over HR's
// allocation — people come when their manager tells them to. The assigned
// shift is kept only when the check-in fits it (on time or up to 60 min early).
export function resolveShiftForCheckIn(
  assigned: Shift | null | undefined,
  nowMinutesOfDay: number,
  role: string | undefined,
  shifts: Shift[]
): Shift | null {
  if (assigned?.start_time) {
    const [h, m] = assigned.start_time.split(':').map(Number)
    const sinceStart = mod(nowMinutesOfDay - (h * 60 + m), MINUTES_PER_DAY)
    const grace = assigned.late_grace_minutes ?? 15
    if (sinceStart <= grace || sinceStart >= MINUTES_PER_DAY - ASSIGNED_EARLY_ALLOWANCE_MINUTES) return assigned
  }
  return findClosestShift(nowMinutesOfDay, role, shifts) ?? assigned ?? null
}
