import { StatRow, num } from './types'

const addMaps = (a?: Record<string, number> | null, b?: Record<string, number> | null) => {
  const out: Record<string, number> = { ...(a ?? {}) }
  for (const [k, v] of Object.entries(b ?? {})) out[k] = Math.round((num(out[k]) + num(v)) * 100) / 100
  return out
}

/**
 * De-duplicate per employee across several runs of one period (e.g. a main run
 * plus top-up runs): amounts and days are SUMMED. Identity fields come from the
 * first row seen, filling blanks from later ones. Output sorted by emp code.
 */
export function mergeRows(rows: StatRow[]): StatRow[] {
  const map = new Map<string, StatRow>()
  for (const r of rows ?? []) {
    if (!r?.empCode) continue
    const cur = map.get(r.empCode)
    if (!cur) {
      map.set(r.empCode, {
        ...r,
        worked: num(r.worked),
        totalEarnings: num(r.totalEarnings),
        extraEarningsTotal: num(r.extraEarningsTotal),
        earnings: addMaps(null, r.earnings),
        deductions: addMaps(null, r.deductions),
      })
    } else {
      cur.worked = num(cur.worked) + num(r.worked)
      cur.totalEarnings = Math.round((num(cur.totalEarnings) + num(r.totalEarnings)) * 100) / 100
      cur.extraEarningsTotal = Math.round((num(cur.extraEarningsTotal) + num(r.extraEarningsTotal)) * 100) / 100
      cur.earnings = addMaps(cur.earnings, r.earnings)
      cur.deductions = addMaps(cur.deductions, r.deductions)
      cur.uan = cur.uan || r.uan
      cur.esiNo = cur.esiNo || r.esiNo
      cur.gender = cur.gender || r.gender
      cur.category = cur.category || r.category
    }
  }
  return [...map.values()].sort((a, b) => a.empCode.localeCompare(b.empCode, 'en', { numeric: true }))
}
