import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { refreshActionCounts } from '@/hooks/useAssignedTasks'
import type { HalfDayDecision } from '@/hooks/useHalfDayCoff'

export interface HalfDayConflictRow {
  request_id: string
  emp_code: string
  name: string
  department: string | null
  leave_date: string
  days: number
  reason: string | null
  hr_outcome: HalfDayDecision
  hr_note: string
  kajal_outcome: HalfDayDecision
  kajal_note: string
  stage: 'plant_head' | 'owner'
  escalated_at: string | null
  escalation_note: string | null
  unused_ledger_days: number
}

/** HR-vs-Kajal half-day comp-off conflicts awaiting ME (plant head first, owner once escalated). */
export function useHalfDayCoffConflicts() {
  const [rows, setRows] = useState<HalfDayConflictRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    const { data, error } = await supabase.rpc('list_halfday_coff_conflicts')
    if (error) setLoadError(error.message)
    else { setLoadError(null); setRows((data ?? []) as HalfDayConflictRow[]) }
    setIsLoading(false)
    setIsRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  /** Returns an error message or null on success. */
  const settle = useCallback(async (requestId: string, decision: HalfDayDecision, note: string): Promise<string | null> => {
    const { error } = await supabase.rpc('decide_halfday_coff', { p_request_id: requestId, p_decision: decision, p_note: note })
    if (error) return error.message
    await load(true)
    refreshActionCounts()
    return null
  }, [load])

  const escalate = useCallback(async (requestId: string, note: string): Promise<string | null> => {
    const { error } = await supabase.rpc('escalate_halfday_coff_conflict', { p_request_id: requestId, p_note: note })
    if (error) return error.message
    await load(true)
    refreshActionCounts()
    return null
  }, [load])

  return { rows, isLoading, isRefreshing, loadError, refresh: () => load(true), settle, escalate }
}
