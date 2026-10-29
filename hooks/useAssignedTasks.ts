import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskStatus = 'open' | 'in_progress' | 'submitted' | 'completed' | 'cancelled'
export type TaskAction = 'start' | 'submit' | 'approve' | 'send_back' | 'cancel'

export interface AssignedTask {
  id: string
  title: string
  description: string | null
  assigned_by: string
  assigned_to: string
  priority: TaskPriority
  due_date: string | null
  status: TaskStatus
  completion_note: string | null
  submitted_at: string | null
  review_note: string | null
  reviewed_at: string | null
  completed_at: string | null
  returned_count: number
  created_at: string
  updated_at: string
  /** Filled in client-side from a second employees query. */
  assigner_name?: string
  assigner_code?: string
  assignee_name?: string
  assignee_code?: string
}

export interface AssignableEmployee {
  id: string
  emp_code: string
  name: string
  department: string | null
  role: string
}

export interface TeamTaskSummaryRow {
  employee_id: string
  emp_code: string
  name: string
  department: string | null
  open_count: number
  in_progress_count: number
  awaiting_count: number
  completed_count: number
  overdue_count: number
  completed_on_time_count: number
  last_completed_at: string | null
}

export interface NewTaskInput {
  assignedTo: string
  title: string
  description?: string
  dueDate: string | null
  priority: TaskPriority
}

// ─── Action-counts store ────────────────────────────────────────────────────
// Fed by my_action_counts() (PATCH_84). Read by every group's tab badges and
// More-menu row pills so a pending decision is never invisible.
export interface ActionCounts {
  tasks_todo: number
  tasks_to_confirm: number
  approvals: number
  needs_your_call: number
  fraud_alerts: number
  /** hr_admin and Kajal (rows awaiting MY decision) (pending half-day comp-off decisions). */
  halfday_coff: number
  /** owner only (decided half-day comp-offs awaiting owner review). */
  halfday_review: number
}
const ZERO_COUNTS: ActionCounts = { tasks_todo: 0, tasks_to_confirm: 0, approvals: 0, needs_your_call: 0, fraud_alerts: 0, halfday_coff: 0, halfday_review: 0 }

interface ActionCountsState {
  counts: ActionCounts
  setCounts: (c: ActionCounts) => void
}
export const useActionCountsStore = create<ActionCountsState>(set => ({
  counts: ZERO_COUNTS,
  setCounts: c => set({ counts: c }),
}))

const toN = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Re-reads my_action_counts(). Keeps the old counts on error (a flaky signal
 *  must not wipe a badge the person still needs to see). */
export async function refreshActionCounts(): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('my_action_counts')
    if (error || !data || typeof data !== 'object') return
    const d = data as Record<string, unknown>
    useActionCountsStore.getState().setCounts({
      tasks_todo: toN(d.tasks_todo),
      tasks_to_confirm: toN(d.tasks_to_confirm),
      approvals: toN(d.approvals),
      needs_your_call: toN(d.needs_your_call),
      fraud_alerts: toN(d.fraud_alerts),
      halfday_coff: toN(d.halfday_coff),
      halfday_review: toN(d.halfday_review),
    })
  } catch {
    // ignore — badge is a convenience, never blocks a screen
  }
}
/** Old name, kept so existing call sites keep working. */
export const refreshTaskBadge = refreshActionCounts

export type BadgeGroup = 'worker' | 'supervisor' | 'manager' | 'hr-admin' | 'plant-head' | 'owner' | 'security'
const n0 = (n: number) => (n > 0 ? n : undefined)

/** Pure: which counts sit on which tab for a role group. `more` = sum of the
 *  counts of rows that live inside that group's More screen. */
export function computeBadges(group: BadgeGroup, c: ActionCounts) {
  // The Tasks tab is the team-tasks screen, which lists tasks awaiting MY
  // confirmation — not my own to-dos (those live under My Tasks in More).
  const tasksTab = c.tasks_to_confirm
  switch (group) {
    case 'owner':
      return { more: n0(c.approvals + c.needs_your_call + c.tasks_todo + c.halfday_review), approvals: undefined, tasks: n0(tasksTab), alerts: n0(c.fraud_alerts) }
    case 'plant-head':
      return { more: n0(c.tasks_todo), approvals: n0(c.approvals), tasks: n0(tasksTab), alerts: undefined }
    case 'hr-admin':
      return { more: n0(c.approvals + c.tasks_todo + c.halfday_coff), approvals: undefined, tasks: n0(tasksTab), alerts: undefined }
    case 'manager':
      return { more: n0(c.tasks_todo + c.tasks_to_confirm), approvals: n0(c.approvals), tasks: undefined, alerts: undefined }
    case 'supervisor':
      return { more: n0(c.tasks_todo + c.tasks_to_confirm), approvals: undefined, tasks: undefined, alerts: undefined }
    case 'worker':
      // Kajal (VFL1567) decides half-day comp-offs; the key is 0 for other members.
      return { more: n0(c.tasks_todo + c.halfday_coff), approvals: undefined, tasks: undefined, alerts: undefined }
    default:
      return { more: n0(c.tasks_todo), approvals: undefined, tasks: undefined, alerts: undefined }
  }
}

const BADGE_POLL_MS = 2 * 60 * 1000

/**
 * Mount ONCE per role-group `_layout.tsx`. Refreshes on mount, whenever the
 * app returns to the foreground, and every 2 minutes while it is active.
 * Returns tabBarBadge values for that group (undefined when 0).
 */
export function useTaskBadgeSync(group: BadgeGroup) {
  const { employee } = useAuth()
  const empId = employee?.id
  const counts = useActionCountsStore(s => s.counts)

  useEffect(() => {
    if (!empId) return
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (timer) return
      timer = setInterval(refreshActionCounts, BADGE_POLL_MS)
    }
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null }
    }
    refreshActionCounts()
    if (AppState.currentState === 'active') start()
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') { refreshActionCounts(); start() } else stop()
    })
    return () => { stop(); sub.remove() }
  }, [empId])

  return computeBadges(group, counts)
}

// ─── Data helpers ───────────────────────────────────────────────────────────
async function attachNames(tasks: AssignedTask[]): Promise<AssignedTask[]> {
  const ids = Array.from(new Set(tasks.flatMap(t => [t.assigned_by, t.assigned_to])))
  if (ids.length === 0) return tasks
  // RPC, not a direct select: employees RLS hides colleagues' rows from members,
  // so an assignee could never read who assigned them the task.
  const { data } = await supabase.rpc('task_people', { p_ids: ids })
  const map = new Map<string, { name: string; emp_code: string }>()
  ;(data || []).forEach((e: any) => map.set(e.id, e))
  return tasks.map(t => ({
    ...t,
    assigner_name: map.get(t.assigned_by)?.name,
    assigner_code: map.get(t.assigned_by)?.emp_code,
    assignee_name: map.get(t.assigned_to)?.name,
    assignee_code: map.get(t.assigned_to)?.emp_code,
  }))
}

async function fetchTasks(filter: (q: any) => any): Promise<AssignedTask[]> {
  const base = supabase.from('assigned_tasks').select('*')
  const { data, error } = await filter(base).order('created_at', { ascending: false }).limit(500)
  if (error) throw new Error(error.message)
  return attachNames((data || []) as AssignedTask[])
}

const errText = (e: any) => (e?.message ? String(e.message) : String(e))

// ─── Write wrappers (usable outside a component) ───────────────────────────
export async function createAssignedTask(input: NewTaskInput): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('create_assigned_task', {
    p_assigned_to: input.assignedTo,
    p_title: input.title.trim(),
    p_description: input.description?.trim() || null,
    p_due_date: input.dueDate,
    p_priority: input.priority,
  })
  await refreshTaskBadge()
  return { error: error ? error.message : null }
}

export async function updateAssignedTask(
  taskId: string,
  action: TaskAction,
  note?: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('update_assigned_task', {
    p_task_id: taskId,
    p_action: action,
    p_note: note?.trim() ? note.trim() : null,
  })
  await refreshTaskBadge()
  return { error: error ? error.message : null }
}

// ─── Hooks ──────────────────────────────────────────────────────────────────
interface ListState<T> {
  data: T
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

function useLoader<T>(initial: T, load: () => Promise<T>, enabled: boolean): ListState<T> {
  const [data, setData] = useState<T>(initial)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await load()
      setData(res)
      setError(null)
    } catch (e) {
      setError(errText(e))
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  useEffect(() => {
    if (!enabled) return
    setIsLoading(true)
    refresh()
  }, [enabled, refresh])

  return { data, isLoading, error, refresh }
}

const EMPTY_TASKS: AssignedTask[] = []
const EMPTY_SUMMARY: TeamTaskSummaryRow[] = []
const EMPTY_PEOPLE: AssignableEmployee[] = []

/** Tasks assigned to me. */
export function useMyTasks() {
  const { employee } = useAuth()
  const id = employee?.id
  const load = useCallback(() => fetchTasks(q => q.eq('assigned_to', id)), [id])
  return useLoader(EMPTY_TASKS, load, !!id)
}

/** Tasks I assigned (RLS also lets owner/plant_head see everything, so the
 *  explicit filter keeps this "mine" even for them). */
export function useTasksIAssigned() {
  const { employee } = useAuth()
  const id = employee?.id
  const load = useCallback(() => fetchTasks(q => q.eq('assigned_by', id)), [id])
  return useLoader(EMPTY_TASKS, load, !!id)
}

/** All visible tasks for one person (RLS decides what the caller may see). */
export function usePersonTasks(personId: string | null) {
  const load = useCallback(
    () => (personId ? fetchTasks(q => q.eq('assigned_to', personId)) : Promise.resolve(EMPTY_TASKS)),
    [personId]
  )
  return useLoader(EMPTY_TASKS, load, !!personId)
}

export function useTeamTaskSummary() {
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('team_task_summary')
    if (error) throw new Error(error.message)
    return (data || []) as TeamTaskSummaryRow[]
  }, [])
  return useLoader(EMPTY_SUMMARY, load, true)
}

export function useAssignableEmployees() {
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_assignable_employees')
    if (error) throw new Error(error.message)
    return (data || []) as AssignableEmployee[]
  }, [])
  return useLoader(EMPTY_PEOPLE, load, true)
}
