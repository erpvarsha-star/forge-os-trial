import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { refreshActionCounts } from '@/hooks/useAssignedTasks'

export interface StageAction {
  id: string
  request_type: string
  request_id: string
  stage_role: string
  actor_id: string | null
  action: 'approved' | 'rejected'
  note: string | null
  acted_at: string
  actor_name?: string
}

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
  /** Fetched separately in the hook (PATCH_113 fields, not in my_turn_*). */
  detail?: import('@/lib/leaveForm').LeaveDetail | null
  granted_days?: number | null
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
  const [stageActions, setStageActions] = useState<Record<string, StageAction[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const fetchApprovals = useCallback(async () => {
    const [{ data: leaveData }, { data: advanceData }] = await Promise.all([
      supabase.rpc('my_turn_leave_requests'),
      supabase.rpc('my_turn_advance_requests'),
    ])
    const leaveRows = (leaveData || []) as MyTurnLeaveRequest[]
    setLeaves(leaveRows)
    setAdvances((advanceData || []) as MyTurnAdvanceRequest[])
    setIsLoading(false)

    const leaveIds = leaveRows.map(l => l.id)
    if (leaveIds.length === 0) { setStageActions({}); return }

    // PATCH_113 fields (detail jsonb, granted_days) are not in my_turn_* —
    // fetch them for the checklist rendering (OD/C-off detail blocks).
    const { data: detailRows } = await supabase
      .from('leave_requests')
      .select('id, detail, granted_days')
      .in('id', leaveIds)
    const detailById: Record<string, { detail: any; granted_days: number | null }> = {}
    ;(detailRows || []).forEach((r: any) => { detailById[r.id] = r })
    setLeaves(leaveRows.map(l => ({ ...l, ...detailById[l.id] })))
    const { data: actions } = await supabase
      .from('request_stage_actions')
      .select('*')
      .eq('request_type', 'leave')
      .in('request_id', leaveIds)
      .order('acted_at', { ascending: true })
    const rows = (actions || []) as StageAction[]
    const actorIds = [...new Set(rows.map(r => r.actor_id).filter(Boolean))] as string[]
    const { data: actors } = actorIds.length
      ? await supabase.from('employees').select('id, name').in('id', actorIds)
      : { data: [] as any[] }
    const nameById: Record<string, string> = {}
    ;(actors || []).forEach((a: any) => { nameById[a.id] = a.name })
    const grouped: Record<string, StageAction[]> = {}
    rows.forEach(r => {
      r.actor_name = r.actor_id ? nameById[r.actor_id] : undefined
      grouped[r.request_id] = grouped[r.request_id] || []
      grouped[r.request_id].push(r)
    })
    setStageActions(grouped)
  }, [])

  useEffect(() => { fetchApprovals() }, [fetchApprovals])

  // p_granted_days is additive (PATCH_113): null = as requested. The RPC
  // enforces "remark mandatory on reject / on day-count change".
  const reviewLeave = async (id: string, approve: boolean, note?: string, grantedDays?: number | null) => {
    setActingId(id)
    const { error } = await supabase.rpc('review_leave_request', {
      p_id: id, p_approve: approve, p_note: note || null, p_granted_days: grantedDays ?? null,
    })
    setActingId(null)
    if (!error) { await fetchApprovals(); refreshActionCounts() }
    return { error }
  }

  // Draws the approved days down from balances (PATCH_113). Idempotent on the
  // server (unique request_id). Called by the card after a FINAL-stage approval.
  const consumeLeave = async (id: string) => {
    const { error } = await supabase.rpc('consume_leave_for_request', { p_request_id: id })
    return { error }
  }

  const reviewAdvance = async (id: string, approve: boolean, note?: string) => {
    setActingId(id)
    const { error } = await supabase.rpc('review_advance_request', { p_id: id, p_approve: approve, p_note: note || null })
    setActingId(null)
    // Tell the requester once the decision is final (server decides). Fire and forget — never blocks or fails the approval.
    if (!error) {
      try { supabase.functions.invoke('app-notify', { body: { action: 'advance_decision', advanceId: id } }).catch(() => {}) } catch {}
    }
    if (!error) { await fetchApprovals(); refreshActionCounts() }
    return { error }
  }

  return { leaves, advances, stageActions, isLoading, actingId, reviewLeave, reviewAdvance, consumeLeave, refresh: fetchApprovals }
}
