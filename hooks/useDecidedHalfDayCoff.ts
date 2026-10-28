import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { refreshActionCounts } from '@/hooks/useAssignedTasks'

export interface DecidedHalfDayCoffRow {
  request_id: string
  emp_code: string
  name: string
  department: string | null
  leave_date: string
  decision: string
  decision_note: string | null
  decided_by_name: string | null
  decided_at: string | null
  owner_reviewed_at: string | null
}

/** Half-day comp-offs HR has already decided; owner marks them reviewed. */
export function useDecidedHalfDayCoff() {
  const [rows, setRows] = useState<DecidedHalfDayCoffRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    const { data, error } = await supabase.rpc('list_decided_halfday_coff')
    if (error) {
      setLoadError(error.message)
    } else {
      setLoadError(null)
      setRows((data ?? []) as DecidedHalfDayCoffRow[])
    }
    setIsLoading(false)
    setIsRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  /** Returns an error message or null on success; reloads and refreshes the red count. */
  const markReviewed = useCallback(async (requestId: string): Promise<string | null> => {
    const { error } = await supabase.rpc('mark_halfday_coff_reviewed', { p_request_id: requestId })
    if (error) return error.message
    await load(true)
    refreshActionCounts()
    return null
  }, [load])

  return { rows, isLoading, isRefreshing, loadError, refresh: () => load(true), markReviewed }
}
