import { Shift } from '@/types'

// When an employee has no shift allotted for today (no employee_shifts row —
// common for anyone whose rotation HR hasn't set yet), check-in used to just
// skip late detection entirely: shiftStart stayed undefined, so rawLateMinutes
// was always 0. Requested by Yash: infer the shift instead, using whichever
// shift's start_time is closest to the actual check-in time, so lateness is
// still evaluated against *something* reasonable rather than never at all.
//
// Restricted to shifts named "Security …" for security_guard, and to
// everything else otherwise: shifts.department is null on every live row (no
// DB-level role scoping), and "Security Day" and "Shift 1" both start at
// 07:00 — an exact tie a plain closest-start-time search would resolve
// arbitrarily, sometimes putting a security guard's check-in on "Shift 1".
export function findClosestShift(nowMinutesOfDay: number, role: string | undefined, shifts: Shift[]): Shift | null {
  const isSecurity = role === 'security_guard'
  const candidates = shifts.filter(s => isSecurity ? s.name.startsWith('Security') : !s.name.startsWith('Security'))
  const pool = candidates.length > 0 ? candidates : shifts
  if (pool.length === 0) return null

  let best: Shift | null = null
  let bestDist = Infinity
  for (const s of pool) {
    const [h, m] = s.start_time.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) continue
    const startMins = h * 60 + m
    const diff = Math.abs(nowMinutesOfDay - startMins)
    // Circular distance — shift start times wrap around midnight (Shift 3
    // starts 00:00), so a plain difference would wrongly favor shifts on
    // the "wrong side" of midnight over ones actually close in wall-clock time.
    const dist = Math.min(diff, 1440 - diff)
    if (dist < bestDist) {
      bestDist = dist
      best = s
    }
  }
  return best
}
