import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface MyOntimeRank {
  rank: number | null
  group_size: number
  on_time_days: number
  category: string
  work_location: string
  month: string
}

export interface OntimeLeader {
  emp_code: string
  name: string
  department: string | null
  category: string
  work_location: string
  on_time_days: number
  late_days: number
  group_size: number
  month: string
}

// Employee's own rank only (PATCH_85 my_ontime_rank). On error `error` is
// set and `data` stays null — the card hides itself rather than showing noise.
// Pass a changing refreshKey (e.g. check-in/out state) to refetch.
export function useMyOntimeRank(refreshKey?: unknown) {
  const [data, setData] = useState<MyOntimeRank | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: rows, error: err } = await supabase.rpc('my_ontime_rank')
      if (cancelled) return
      if (err) {
        console.warn('my_ontime_rank failed', err.message)
        setError(err.message)
        setData(null)
      } else {
        setError(null)
        setData(rows && rows.length > 0 ? (rows[0] as MyOntimeRank) : null)
      }
      setIsLoading(false)
    })()
    return () => { cancelled = true }
  }, [refreshKey])

  return { data, error, isLoading }
}

// Owner only (RPC raises for anyone else).
export function useOntimeRaceLeaders() {
  const [leaders, setLeaders] = useState<OntimeLeader[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const { data, error: err } = await supabase.rpc('ontime_race_leaders')
    if (err) {
      setError(err.message)
      setLeaders([])
    } else {
      setError(null)
      setLeaders((data || []) as OntimeLeader[])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { leaders, error, isLoading, refresh }
}
