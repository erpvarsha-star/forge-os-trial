import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { LeaveRequest, LeaveBalance } from '@/types'

export function useLeave(employeeId: string) {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!employeeId) return
    setIsLoading(true)

    const { data: reqData } = await supabase
      .from('leave_requests')
      .select('*, employee:employees(*)')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })

    if (reqData) setRequests(reqData as LeaveRequest[])

    const { data: balData } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('year', new Date().getFullYear())
      .single()

    if (balData) setBalance(balData as LeaveBalance)
    setIsLoading(false)
  }, [employeeId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const applyLeave = async (payload: Partial<LeaveRequest>) => {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({ ...payload, employee_id: employeeId, status: 'pending' })
      .select()
      .single()

    if (!error) await fetchData()
    return { data, error }
  }

  return { requests, balance, isLoading, applyLeave, refresh: fetchData }
}
