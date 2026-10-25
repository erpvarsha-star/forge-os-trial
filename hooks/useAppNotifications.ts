import { useState, useEffect, useCallback, useMemo } from 'react'
import { AppState } from 'react-native'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// Server-written bell rows (payslip_ready, advance_approved/rejected, pune_attendance_reminder, ...).
// Employees can only SELECT their own rows; marking read goes through the app-notify edge function.
export interface AppNotificationRow {
  id: string
  employee_code: string
  type: string
  title_en: string | null
  title_hi: string | null
  body_en: string | null
  body_hi: string | null
  payload: Record<string, any> | null
  read_at: string | null
  created_at: string
}

// Row shape of the OLD `notifications` bell store
interface LegacyNotificationRow {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  created_at: string
}

export interface BellItem {
  key: string
  source: 'legacy' | 'app'
  id: string
  type: string
  title: string
  body: string
  read: boolean
  created_at: string
}

/** Pick the Hindi text when the UI language is Hindi, otherwise English; fall back to whichever exists. */
export const pickLocalized = (lang: string, en: string | null, hi: string | null) =>
  (lang === 'hi' ? hi || en : en || hi) ?? ''

export function useAppNotifications() {
  const { employee } = useAuth()
  const { i18n } = useTranslation()
  const [rows, setRows] = useState<AppNotificationRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!employee) return
    const { data } = await supabase.from('app_notifications').select('*')
      .eq('employee_code', employee.emp_code)
      .order('created_at', { ascending: false }).limit(50)
    setRows((data ?? []) as AppNotificationRow[])
    setIsLoading(false)
  }, [employee])

  useEffect(() => { refresh() }, [refresh])
  // Re-check when the app returns to the foreground so the badge does not go stale
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') refresh() })
    return () => sub.remove()
  }, [refresh])

  const items = useMemo(() => rows.map(r => ({
    ...r,
    title: pickLocalized(i18n.language, r.title_en, r.title_hi),
    body: pickLocalized(i18n.language, r.body_en, r.body_hi),
  })), [rows, i18n.language])

  const unreadCount = rows.filter(r => !r.read_at).length

  const markRead = useCallback(async (ids?: string[]) => {
    try {
      const { error } = await supabase.functions.invoke('app-notify', { body: { action: 'mark_read', ...(ids ? { ids } : {}) } })
      if (error) return
    } catch { return }
    await refresh()
  }, [refresh])

  return { items, unreadCount, isLoading, markRead, refresh }
}

/**
 * One bell over both stores: the old `notifications` table and `app_notifications`,
 * merged newest-first. unreadCount sums both; markAllRead clears both
 * (old table via its owner-update policy, new table via app-notify).
 */
export function useUnifiedNotifications() {
  const { employee } = useAuth()
  const app = useAppNotifications()
  const [legacy, setLegacy] = useState<LegacyNotificationRow[]>([])
  const [legacyLoading, setLegacyLoading] = useState(true)

  const refreshLegacy = useCallback(async () => {
    if (!employee) return
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', employee.id).order('created_at', { ascending: false }).limit(50)
    setLegacy((data ?? []) as LegacyNotificationRow[])
    setLegacyLoading(false)
  }, [employee])

  useEffect(() => { refreshLegacy() }, [refreshLegacy])

  const items: BellItem[] = useMemo(() => [
    ...legacy.map(n => ({ key: `l-${n.id}`, source: 'legacy' as const, id: n.id, type: n.type, title: n.title, body: n.body, read: !!n.read, created_at: n.created_at })),
    ...app.items.map(n => ({ key: `a-${n.id}`, source: 'app' as const, id: n.id, type: n.type, title: n.title, body: n.body, read: !!n.read_at, created_at: n.created_at })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), [legacy, app.items])

  const unreadCount = legacy.filter(n => !n.read).length + app.unreadCount

  const markAllRead = useCallback(async () => {
    if (!employee) return
    if (legacy.some(n => !n.read)) {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', employee.id).eq('read', false)
      if (!error) await refreshLegacy()
    }
    const unreadIds = app.items.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length) await app.markRead(unreadIds)
  }, [employee, legacy, app, refreshLegacy])

  return { items, unreadCount, isLoading: legacyLoading || app.isLoading, markAllRead, refresh: async () => { await Promise.all([refreshLegacy(), app.refresh()]) } }
}
