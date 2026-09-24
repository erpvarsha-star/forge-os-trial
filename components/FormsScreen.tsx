import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { router } from 'expo-router'
import { ClipboardList, ExternalLink, Clock, ChevronRight, Settings } from 'lucide-react-native'
import { useAuth } from '@/hooks/useAuth'
import { useEffectiveIdentity } from '@/hooks/useEffectiveIdentity'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { LoadingScreen } from '@/components/LoadingScreen'
import { BRAND } from '@/components/theme'
import { supabase } from '@/lib/supabase'

interface FormLink {
  id: string
  department: string
  form_name: string
  frequency: string
  responsible_person: string | null
  url: string
  send_in_reminder: boolean
  is_common: boolean
}

interface FormSubmission {
  shift: string | null
  status: 'ON TIME' | 'LATE' | 'MISSING'
}

interface ShiftWindow {
  shift: string
  start: string
  end: string
  deadline: string
}

function istNow(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
}

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

function SectionLabel({ title }: { title: string }) {
  return (
    <View className="mt-5 mb-2">
      <Text className="text-xs font-bold uppercase tracking-widest text-ink-400">{title}</Text>
    </View>
  )
}

function InAppCard({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentType<{ size: number; color: string }>
  title: string
  subtitle: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity onPress={onPress} className="mb-2 min-h-touch">
      <Card>
        <View className="flex-row items-center gap-3">
          <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center">
            <Icon size={18} color={BRAND[600]} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-ink-900">{title}</Text>
            <Text className="text-xs text-ink-500 mt-0.5">{subtitle}</Text>
          </View>
          <ChevronRight size={16} color="#B9C0CC" />
        </View>
      </Card>
    </TouchableOpacity>
  )
}

function ExternalFormCard({ item, onPress }: { item: FormLink; onPress: (f: FormLink) => void }) {
  return (
    <TouchableOpacity onPress={() => onPress(item)} className="mb-2 min-h-touch">
      <Card>
        <View className="flex-row items-center gap-3">
          <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center">
            <ClipboardList size={18} color={BRAND[600]} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-ink-900">{item.form_name}</Text>
            <Text className="text-xs text-ink-500 mt-0.5">
              {item.frequency}
              {item.send_in_reminder ? '' : ` · no reminder`}
            </Text>
          </View>
          <ExternalLink size={16} color={BRAND[600]} />
        </View>
      </Card>
    </TouchableOpacity>
  )
}

export function FormsScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { department } = useEffectiveIdentity()
  const [commonForms, setCommonForms] = useState<FormLink[]>([])
  const [mgmtForms, setMgmtForms] = useState<FormLink[]>([])
  const [deptForms, setDeptForms] = useState<FormLink[]>([])
  const [shifts, setShifts] = useState<ShiftWindow[]>([])
  const [submitted, setSubmitted] = useState<Record<string, FormSubmission['status']>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const role = employee?.role
  const showDeptForms = role === 'supervisor' || role === 'manager' || role === 'security_guard'
  const showMgmtForms = role === 'manager' || role === 'plant_head' || role === 'owner'
  const showHrOps = role === 'hr_admin'

  const load = useCallback(async () => {
    if (!employee) return
    const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const dept = department ?? employee.department

    const queries: Promise<any>[] = [
      supabase.from('form_links').select('*').eq('is_common', true).eq('is_active', true).order('sort_order'),
      supabase.from('plant_config').select('config_value').eq('config_key', 'form_shift_schedule').maybeSingle(),
    ]

    let mgmtIdx = -1
    let deptIdx = -1
    let subIdx = -1

    if (showMgmtForms) {
      mgmtIdx = queries.length
      queries.push(
        supabase.from('form_links').select('*').eq('department', 'MANAGEMENT').eq('is_active', true).order('sort_order'),
      )
    }

    if (showDeptForms) {
      deptIdx = queries.length
      queries.push(
        supabase.from('form_links').select('*').eq('department', dept).eq('is_active', true).eq('is_common', false).order('sort_order'),
      )
      subIdx = queries.length
      queries.push(
        supabase.from('form_submissions').select('shift, status').eq('department', dept).eq('date', today),
      )
    }

    const results = await Promise.all(queries)
    const [commonResult, configResult] = results

    if (commonResult.data) setCommonForms(commonResult.data as FormLink[])

    const schedule = configResult.data?.config_value as { shifts?: ShiftWindow[] } | null
    setShifts(Array.isArray(schedule?.shifts) ? schedule.shifts : [])

    if (mgmtIdx >= 0 && results[mgmtIdx]?.data) setMgmtForms(results[mgmtIdx].data as FormLink[])
    if (deptIdx >= 0 && results[deptIdx]?.data) setDeptForms(results[deptIdx].data as FormLink[])

    const status: Record<string, FormSubmission['status']> = {}
    for (const row of (subIdx >= 0 ? (results[subIdx]?.data ?? []) : []) as FormSubmission[]) {
      if (row.shift) status[row.shift] = row.status
    }
    setSubmitted(status)

    setIsLoading(false)
  }, [employee, department, showDeptForms, showMgmtForms])

  useEffect(() => { load() }, [load])

  const onRefresh = async () => {
    setIsRefreshing(true)
    await load()
    setIsRefreshing(false)
  }

  const openURL = async (form: FormLink) => {
    try {
      const supported = await Linking.canOpenURL(form.url)
      if (!supported) { Alert.alert(t('common.error'), t('common.cannotOpenLink')); return }
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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {/* MY REQUESTS — every role */}
        <SectionLabel title={t('forms.myRequests')} />

        {commonForms.map(form => (
          <ExternalFormCard key={form.id} item={form} onPress={openURL} />
        ))}
        {commonForms.length === 0 && (
          <Text className="text-xs text-ink-400 mb-1">{t('forms.commonPending')}</Text>
        )}

        {/* MANAGEMENT FORMS — manager, plant_head, owner */}
        {showMgmtForms && mgmtForms.length > 0 && (
          <>
            <SectionLabel title={t('forms.managementForms')} />
            {mgmtForms.map(form => (
              <ExternalFormCard key={form.id} item={form} onPress={openURL} />
            ))}
          </>
        )}

        {/* HR OPERATIONS — hr_admin only */}
        {showHrOps && (
          <>
            <SectionLabel title={t('forms.hrOperations')} />
            <InAppCard
              icon={Settings}
              title={t('forms.shiftPlanning')}
              subtitle={t('forms.shiftPlanningSub')}
              onPress={() => router.push('./shifts')}
            />
          </>
        )}

        {/* DEPARTMENT FORMS — supervisor, manager, security */}
        {showDeptForms && (
          <>
            <SectionLabel title={t('forms.deptForms')} />
            <Text className="text-xs text-ink-500 mb-3">
              {department ?? employee.department} · {t('forms.count', { count: deptForms.length })}
            </Text>

            {shifts.length > 0 && (
              <View className="flex-row gap-2 mb-3">
                {shifts.map(s => {
                  const state = submitted[s.shift]
                  const done = state === 'ON TIME' || state === 'LATE'
                  return (
                    <View key={s.shift} className={`flex-1 rounded-xl px-2 py-2 border ${done ? 'bg-green-50 border-green-200' : 'bg-white border-ink-100'}`}>
                      <Text className="text-xs font-bold text-ink-900" numberOfLines={1}>{s.shift}</Text>
                      <Text className={`text-xs mt-0.5 ${done ? 'text-green-700' : 'text-ink-500'}`} numberOfLines={1}>
                        {done ? t('forms.shiftIn') : t('forms.shiftPending')}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}

            {due && (
              <Card variant="flat" className="mb-3 bg-brand-50 border-brand-200">
                <View className="flex-row items-center gap-3">
                  <Clock size={18} color={BRAND[600]} />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-ink-900">{t('forms.nextDeadline', { time: formatHm(due.at) })}</Text>
                    <Text className="text-xs text-ink-600 mt-0.5">{due.shift} · {t('forms.deadlineHint')}</Text>
                  </View>
                </View>
              </Card>
            )}

            {deptForms.length === 0 ? (
              <EmptyState
                icon={<ClipboardList size={40} color="#D1D5DB" />}
                title={t('forms.emptyTitle')}
                message={t('forms.emptyMessage', { department: department ?? employee.department })}
              />
            ) : (
              deptForms.map(form => (
                <ExternalFormCard key={form.id} item={form} onPress={openURL} />
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}
