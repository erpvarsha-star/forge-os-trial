import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface OnboardingDept {
  code: string
  label_en: string
  label_hi: string | null
  sort_order: number
}

export interface ChecklistRow {
  id: string
  employee_code: string
  department: string
  completed: boolean
  completed_by: string | null
  completed_at: string | null
  notes: string | null
}

export interface OnboardingEmployee {
  id: string
  emp_code: string
  name: string
  department: string | null
}

/** Upsert one checklist row per active onboarding department. Idempotent: existing rows are never touched. */
export async function ensureChecklist(empCode: string): Promise<{ error: string | null }> {
  const { data: depts, error: dErr } = await supabase
    .from('onboarding_departments').select('code').eq('active', true)
  if (dErr) return { error: dErr.message }
  const rows = (depts ?? []).map((d: { code: string }) => ({ employee_code: empCode, department: d.code }))
  if (!rows.length) return { error: null }
  const { error } = await supabase
    .from('onboarding_checklists')
    .upsert(rows, { onConflict: 'employee_code,department', ignoreDuplicates: true })
  return { error: error ? error.message : null }
}

/** Format a UTC instant as IST text (DD/MM/YYYY HH:MM). Display only; never used to decide "today". */
export function formatIst(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  const d = new Date(ms + 5.5 * 3600 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

async function fetchAllChecklists(): Promise<ChecklistRow[]> {
  const out: ChecklistRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('onboarding_checklists').select('*')
      .order('created_at', { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as ChecklistRow[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

export function useOnboarding() {
  const [employees, setEmployees] = useState<OnboardingEmployee[]>([])
  const [depts, setDepts] = useState<OnboardingDept[]>([])
  const [rows, setRows] = useState<ChecklistRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [e, d, c] = await Promise.all([
        supabase.from('employees').select('id, emp_code, name, department').eq('is_active', true).order('name'),
        supabase.from('onboarding_departments').select('code,label_en,label_hi,sort_order').eq('active', true).order('sort_order'),
        fetchAllChecklists(),
      ])
      if (e.error) throw new Error(e.error.message)
      if (d.error) throw new Error(d.error.message)
      setEmployees((e.data ?? []) as OnboardingEmployee[])
      setDepts((d.data ?? []) as OnboardingDept[])
      setRows(c)
      setError(null)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const activeCodes = useMemo(() => new Set(depts.map(d => d.code)), [depts])

  /** emp_code -> number of active departments completed */
  const doneByEmp = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach(r => {
      if (r.completed && activeCodes.has(r.department)) m.set(r.employee_code, (m.get(r.employee_code) ?? 0) + 1)
    })
    return m
  }, [rows, activeCodes])

  const total = depts.length

  const progress = useCallback((empCode: string) => {
    const done = doneByEmp.get(empCode) ?? 0
    return { done, total, onboarded: total > 0 && done === total }
  }, [doneByEmp, total])

  return { employees, depts, rows, isLoading, error, refresh, progress, total }
}

/** Checklist for one employee: ensures the rows exist, then toggles/saves them. */
export function useEmployeeChecklist(empCode: string | null) {
  const { employee } = useAuth()
  const [rows, setRows] = useState<ChecklistRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!empCode) return
    setIsLoading(true)
    const ens = await ensureChecklist(empCode)
    const { data, error: err } = await supabase.from('onboarding_checklists').select('*').eq('employee_code', empCode)
    setError(ens.error ?? (err ? err.message : null))
    setRows((data ?? []) as ChecklistRow[])
    setIsLoading(false)
  }, [empCode])

  useEffect(() => { setRows([]); load() }, [load])

  const save = useCallback(async (department: string, completed: boolean, notes: string): Promise<string | null> => {
    if (!empCode || !employee) return 'not signed in'
    const patch = {
      completed,
      completed_by: completed ? employee.emp_code : null,
      completed_at: completed ? new Date().toISOString() : null, // UTC instant for timestamptz
      notes: notes.trim() ? notes.trim() : null,
    }
    const { error: err } = await supabase.from('onboarding_checklists').update(patch)
      .eq('employee_code', empCode).eq('department', department)
    if (err) return err.message
    setRows(prev => prev.map(r => (r.department === department ? { ...r, ...patch } : r)))
    return null
  }, [empCode, employee])

  return { rows, isLoading, error, save, reload: load }
}
