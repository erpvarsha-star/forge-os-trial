import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { refreshActionCounts } from '@/hooks/useAssignedTasks'

export interface HalfDayCoffRow {
  request_id: string
  emp_code: string
  name: string
  department: string | null
  leave_date: string
  days: number
  reason: string | null
  approved_at: string
  unused_ledger_days: number
  hr_decided?: boolean
  kajal_decided?: boolean
  is_conflict?: boolean
  hr_outcome?: HalfDayDecision | null
  kajal_outcome?: HalfDayDecision | null
}

export type HalfDayDecision = 'deduct_full_day' | 'no_deduction'

/** Half-day comp-off requests awaiting MY decision (HR or Kajal); owner sees HR/Kajal conflicts. */
export function useHalfDayCoff() {
  const [rows, setRows] = useState<HalfDayCoffRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    const { data, error } = await supabase.rpc('list_pending_halfday_coff')
    if (error) {
      setLoadError(error.message)
    } else {
      setLoadError(null)
      setRows((data ?? []) as HalfDayCoffRow[])
    }
    setIsLoading(false)
    setIsRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  /** Returns an error message or null on success; reloads the list on success. */
  const decide = useCallback(async (requestId: string, decision: HalfDayDecision, note: string): Promise<string | null> => {
    const { error } = await supabase.rpc('decide_halfday_coff', {
      p_request_id: requestId,
      p_decision: decision,
      p_note: note,
    })
    if (error) return error.message
    await load(true)
    refreshActionCounts()
    return null
  }, [load])

  return { rows, isLoading, isRefreshing, loadError, refresh: () => load(true), decide }
}

/** True when the signed-in person is allowed to decide half-day comp-offs (HR or Kajal). */
export function useIsHalfDayCoffDecider(): boolean {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    let alive = true
    supabase.rpc('my_halfday_coff_decider').then(({ data, error }) => {
      if (alive && !error) setOk(data === true)
    })
    return () => { alive = false }
  }, [])
  return ok
}
