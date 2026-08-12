import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, Linking, Alert, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ClipboardList, ExternalLink, Clock } from 'lucide-react-native'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { LoadingScreen } from '@/components/LoadingScreen'
import { BRAND } from '@/components/theme'
import { supabase } from '@/lib/supabase'

/**
 * The forms tab — one screen listing every Google Form this employee's
 * department is expected to fill, straight from `form_links` (PATCH_14).
 *
 * Before this, the only way a supervisor got a form link was a Telegram alert
 * from ALERT.gs, and for the first week of August those alerts shipped the
 * literal text "[Google Form Link]" instead of a URL. A tab they can open at
 * any time is the fix; the alert becomes a nudge rather than the only route.
 *
 * Scoped by `employees.department`, which is why PATCH_14 stores the registry
 * under the employees spelling ('Heat Treatment') and not the Operations
 * Dashboard spelling ('HT').
 *
 * The deadline strip at the top is the same schedule the shift-reminder edge
 * function notifies on (`plant_config.form_shift_schedule`), read from the
 * same row so the two can never drift. It is shown to say *when* a form is
 * due — nothing here scores anyone, per Yash 12 Aug.
 */

interface FormLink {
  id: string
  department: string
  form_name: string
  frequency: string
  responsible_person: string | null
  url: string
  send_in_reminder: boolean
}

interface ShiftWindow {
  shift: string
  start: string
  end: string
  deadline: string
}

/** IST wall-clock as a Date whose UTC fields read as IST. Matches the edge function. */
function istNow(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
}

/**
 * The next form deadline from now, in IST.
 *
 * A deadline whose clock time has already passed today belongs to tomorrow —
 * that single rule covers Shift 2 (23:30 end, 00:30 deadline) and Shift 3
 * (23:30 start, 09:30 deadline next morning) without special-casing either.
 */
function nextDeadline(shifts: ShiftWindow[]): { shift: string; at: Date } | null {
  const now = istNow()
  let best: { shift: string; at: Date } | null = null

  for (const s of shifts) {
    const [h, m] = s.deadline.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) continue

    const at = new Date(now)
    at.setUTCHours(h, m, 0, 0)
    if (at.getTime() <= now.getTime()) at.setUTCDate(at.getUTCDate() + 1)

    if (!best || at.getTime() < best.at.getTime()) best = { shift: s.shift, at }
  }
  return best
}

function formatHm(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function FormsScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [forms, setForms] = useState<FormLink[]>([])
  const [shifts, setShifts] = useState<ShiftWindow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!employee) return

    const [formsResult, configResult] = await Promise.all([
      supabase
        .from('form_links')
        .select('*')
        .eq('department', employee.department)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('plant_config')
        .select('config_value')
        .eq('config_key', 'form_shift_schedule')
        .maybeSingle(),
    ])

    if (formsResult.data) setForms(formsResult.data as FormLink[])

    // Absent config is not an error — the tab still lists forms, it just
    // cannot say when the next one is due.
    const schedule = configResult.data?.config_value as { shifts?: ShiftWindow[] } | null
    setShifts(Array.isArray(schedule?.shifts) ? schedule.shifts : [])

    setIsLoading(false)
  }, [employee])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = async () => {
    setIsRefreshing(true)
    await load()
    setIsRefreshing(false)
  }

  const open = async (form: FormLink) => {
    try {
      const supported = await Linking.canOpenURL(form.url)
      if (!supported) {
        Alert.alert(t('common.error'), t('common.cannotOpenLink'))
        return
      }
      await Linking.openURL(form.url)
    } catch {
      Alert.alert(t('common.error'), t('common.cannotOpenLink'))
    }
  }

  if (!employee || isLoading) return <LoadingScreen />

  const due = nextDeadline(shifts)

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />

      <FlatList
        data={forms}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View className="mb-3">
            <Text className="text-lg font-bold text-ink-900 tracking-tight">{t('forms.title')}</Text>
            <Text className="text-xs text-ink-500 mt-0.5">
              {employee.department} · {t('forms.count', { count: forms.length })}
            </Text>

            {due && (
              <Card variant="flat" className="mt-3 bg-brand-50 border-brand-200">
                <View className="flex-row items-center gap-3">
                  <Clock size={18} color={BRAND[600]} />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-ink-900">
                      {t('forms.nextDeadline', { time: formatHm(due.at) })}
                    </Text>
                    <Text className="text-xs text-ink-600 mt-0.5">
                      {due.shift} · {t('forms.deadlineHint')}
                    </Text>
                  </View>
                </View>
              </Card>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => open(item)} className="mb-2 min-h-touch">
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center">
                  <ClipboardList size={18} color={BRAND[600]} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-ink-900">{item.form_name}</Text>
                  <Text className="text-xs text-ink-500 mt-0.5">
                    {item.frequency}
                    {item.send_in_reminder ? '' : ` · ${t('forms.notReminded')}`}
                  </Text>
                </View>
                <ExternalLink size={16} color={BRAND[600]} />
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<ClipboardList size={40} color="#D1D5DB" />}
            title={t('forms.emptyTitle')}
            message={t('forms.emptyMessage', { department: employee.department })}
          />
        }
      />
    </View>
  )
}
