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
const MINUTES_PER_DAY = 1440

const mod = (n: number, m: number) => ((n % m) + m) % m

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
    .sort((a, b) => a.startMin - b.startMin)

  if (withStart.length === 0) return null
  if (withStart.length === 1) return withStart[0].shift

  for (let i = 0; i < withStart.length; i++) {
    const current = withStart[i]
    const next = withStart[(i + 1) % withStart.length]
    const windowStart = current.startMin - EARLY_ARRIVAL_BUFFER_MINUTES
    const windowEnd = next.startMin - EARLY_ARRIVAL_BUFFER_MINUTES
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
