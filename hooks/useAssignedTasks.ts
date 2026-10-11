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

// ─── Badge store ────────────────────────────────────────────────────────────
// One shared count, read by every group's More tab badge and More-menu rows.
interface TaskBadgeState {
  count: number
  setCount: (n: number) => void
}
export const useTaskBadgeStore = create<TaskBadgeState>(set => ({
  count: 0,
  setCount: n => set({ count: n }),
}))

/** Re-reads my_task_action_count(). Keeps the old count on error (a flaky
 *  signal must not wipe a badge the person still needs to see). */
export async function refreshTaskBadge(): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('my_task_action_count')
    if (error) return
    const n = typeof data === 'number' ? data : Number(data)
    useTaskBadgeStore.getState().setCount(Number.isFinite(n) && n > 0 ? n : 0)
  } catch {
    // ignore — badge is a convenience, never blocks a screen
  }
}

const BADGE_POLL_MS = 2 * 60 * 1000

/**
 * Mount ONCE per role-group `_layout.tsx`. Refreshes on mount, whenever the
 * app returns to the foreground, and every 2 minutes while it is active.
 * Returns the count for tabBarBadge (undefined when 0).
 */
export function useTaskBadgeSync(): number | undefined {
  const { employee } = useAuth()
  const empId = employee?.id
  const count = useTaskBadgeStore(s => s.count)

  useEffect(() => {
    if (!empId) return
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (timer) return
      timer = setInterval(refreshTaskBadge, BADGE_POLL_MS)
    }
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null }
    }
    refreshTaskBadge()
    if (AppState.currentState === 'active') start()
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') { refreshTaskBadge(); start() } else stop()
    })
    return () => { stop(); sub.remove() }
  }, [empId])

  return count > 0 ? count : undefined
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
