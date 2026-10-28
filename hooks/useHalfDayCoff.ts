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
}

export type HalfDayDecision = 'deduct_full_day' | 'no_deduction'

/** Pending half-day comp-off requests awaiting an HR / plant head decision. */
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
