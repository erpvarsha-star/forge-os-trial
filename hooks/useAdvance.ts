import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { AdvanceRequest } from '@/types'

export function useAdvance(employeeId: string) {
  const [requests, setRequests] = useState<AdvanceRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!employeeId) return
    setIsLoading(true)
    const { data } = await supabase
      .from('advance_requests')
      .select('*, employee:employees(*)')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
    if (data) setRequests(data as AdvanceRequest[])
    setIsLoading(false)
  }, [employeeId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const applyAdvance = async (payload: Partial<AdvanceRequest>) => {
    const { data, error } = await supabase
      .from('advance_requests')
      .insert({ ...payload, employee_id: employeeId, status: 'pending' })
      .select()
      .single()
    if (!error) await fetchData()
    return { data, error }
  }

  return { requests, isLoading, applyAdvance, refresh: fetchData }
}
