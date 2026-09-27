import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface MyTurnLeaveRequest {
  id: string
  employee_id: string
  emp_code: string
  name: string
  department: string
  type: string
  start_date: string
  end_date: string
  days: number
  reason: string | null
  created_at: string
  current_stage: number
  approval_chain: string[]
  stage_role: string
}

export interface MyTurnAdvanceRequest {
  id: string
  employee_id: string
  emp_code: string
  name: string
  department: string
  amount: number
  reason: string | null
  repayment_months: number
  created_at: string
  current_stage: number
  approval_chain: string[]
  stage_role: string
}

// Requests awaiting the current user's action at their specific stage in
// the approval chain (server-scoped by my_turn_leave_requests()/
// my_turn_advance_requests() — see PATCH_53). Works the same for every
// role that can appear in a chain (manager, hr_admin, accounts-department
// manager, plant_head, owner) since the RPCs already resolve "is it my
// turn" from the caller's own identity — no per-screen filtering needed.
export function useLeaveAdvanceApprovals() {
  const [leaves, setLeaves] = useState<MyTurnLeaveRequest[]>([])
  const [advances, setAdvances] = useState<MyTurnAdvanceRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const fetchApprovals = useCallback(async () => {
    const [{ data: leaveData }, { data: advanceData }] = await Promise.all([
      supabase.rpc('my_turn_leave_requests'),
      supabase.rpc('my_turn_advance_requests'),
    ])
    setLeaves((leaveData || []) as MyTurnLeaveRequest[])
    setAdvances((advanceData || []) as MyTurnAdvanceRequest[])
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchApprovals() }, [fetchApprovals])

  const reviewLeave = async (id: string, approve: boolean, note?: string) => {
    setActingId(id)
    const { error } = await supabase.rpc('review_leave_request', { p_id: id, p_approve: approve, p_note: note || null })
    setActingId(null)
    if (!error) await fetchApprovals()
    return { error }
  }

  const reviewAdvance = async (id: string, approve: boolean, note?: string) => {
    setActingId(id)
    const { error } = await supabase.rpc('review_advance_request', { p_id: id, p_approve: approve, p_note: note || null })
    setActingId(null)
    if (!error) await fetchApprovals()
    return { error }
  }

  return { leaves, advances, isLoading, actingId, reviewLeave, reviewAdvance, refresh: fetchApprovals }
}
