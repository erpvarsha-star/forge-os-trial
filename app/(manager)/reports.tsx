import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Section } from '@/components/Section'
import { StatTile } from '@/components/StatTile'
import { EmptyState } from '@/components/EmptyState'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Users, CalendarCheck, Clock, Wrench, FileText } from 'lucide-react-native'
import { BRAND, INK } from '@/components/theme'

interface DayPoint {
  date: string
  presentPct: number
}

interface ScoreRow {
  name: string
  empCode: string
  composite: number
}

/**
 * Department report for a manager.
 *
 * Scoped to the manager's own department throughout — mirroring
 * manager/dashboard.tsx, which filters employees by `department`. A manager
 * must not see plant-wide figures here; that is the plant-head/owner view.
 *
 * Every figure is derived from tables that actually hold data today
 * (attendance_records, leave_requests, advance_requests,
 * maintenance_observations, monthly_scores). Nothing here is sample data.
 */
export default function ManagerReports() {
  const { t } = useTranslation()
  const { employee } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [headcount, setHeadcount] = useState(0)
  const [monthAttendancePct, setMonthAttendancePct] = useState(0)
  const [lateCount, setLateCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [trend, setTrend] = useState<DayPoint[]>([])
  const [pendingLeave, setPendingLeave] = useState(0)
  const [pendingAdvance, setPendingAdvance] = useState(0)
  const [openObservations, setOpenObservations] = useState(0)
  const [topScorers, setTopScorers] = useState<ScoreRow[]>([])

  useEffect(() => { load() }, [employee])

  const load = async () => {
    if (!employee?.department) { setIsLoading(false); return }

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const monthStart = new Date(year, month, 1).toISOString().split('T')[0]
    const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0]

    const { data: deptEmployees } = await supabase
      .from('employees')
      .select('id, name, emp_code')
      .eq('department', employee.department)
      .eq('is_active', true)

    const ids = (deptEmployees ?? []).map(e => e.id)
    setHeadcount(ids.length)

    if (ids.length === 0) { setIsLoading(false); setIsRefreshing(false); return }

    const [{ data: attendance }, { data: leaves }, { data: advances }, { data: observations }, { data: scores }] =
      await Promise.all([
        supabase.from('attendance_records').select('date, status, late_minutes').in('employee_id', ids).gte('date', monthStart).lte('date', monthEnd),
        supabase.from('leave_requests').select('id').in('employee_id', ids).eq('status', 'pending'),
        supabase.from('advance_requests').select('id').in('employee_id', ids).eq('status', 'pending'),
        supabase.from('maintenance_observations').select('id').in('employee_id', ids).neq('status', 'resolved'),
        supabase
          .from('monthly_scores')
          .select('employee_id, composite_score')
          .in('employee_id', ids)
          .eq('year', year)
          .eq('month', String(month + 1).padStart(2, '0'))
          .order('composite_score', { ascending: false })
          .limit(5),
      ])

    const rows = attendance ?? []

    // Week-offs and holidays are not attendance failures, so they are excluded
    // from the denominator rather than counted as absence.
    const workingRows = rows.filter(r => !['WO', 'H'].includes(r.status))
    const presentRows = workingRows.filter(r => ['P', 'HL'].includes(r.status))
    setMonthAttendancePct(workingRows.length > 0 ? (presentRows.length / workingRows.length) * 100 : 0)
    setLateCount(presentRows.filter(r => (r.late_minutes ?? 0) > 0).length)

    const counts: Record<string, number> = {}
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1
    setStatusCounts(counts)

    // Daily present-% for the last 10 recorded working days, most recent last.
    const byDate = new Map<string, { present: number; total: number }>()
    for (const r of workingRows) {
      const bucket = byDate.get(r.date) ?? { present: 0, total: 0 }
      bucket.total += 1
      if (['P', 'HL'].includes(r.status)) bucket.present += 1
      byDate.set(r.date, bucket)
    }
    setTrend(
      [...byDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-10)
        .map(([date, v]) => ({ date, presentPct: v.total > 0 ? (v.present / v.total) * 100 : 0 }))
    )

    setPendingLeave(leaves?.length ?? 0)
    setPendingAdvance(advances?.length ?? 0)
    setOpenObservations(observations?.length ?? 0)

    const nameById = new Map((deptEmployees ?? []).map(e => [e.id, e]))
    setTopScorers(
      (scores ?? []).map(s => {
        const emp = nameById.get(s.employee_id)
        return {
          name: emp?.name ?? '—',
          empCode: emp?.emp_code ?? '',
          composite: Number(s.composite_score ?? 0),
        }
      })
    )

    setIsLoading(false)
    setIsRefreshing(false)
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const statusLabels: Record<string, string> = {
    P: t('common.present'),
    A: t('common.absent'),
    L: t('common.onLeave'),
    HL: t('manager.halfDay'),
    WO: t('common.weekOff'),
    H: t('common.holiday'),
  }

  const maxTrend = Math.max(100, ...trend.map(p => p.presentPct))

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); load() }} tintColor={BRAND[600]} />
        }
      >
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('common.reports')}</Text>
          <Text className="text-sm text-ink-500 mt-0.5">
            {employee.department} · {t('manager.thisMonthLabel')}
          </Text>
        </View>

        {headcount === 0 ? (
          <Card>
            <EmptyState
              title={t('manager.noDeptEmployees')}
              message={t('manager.noDeptEmployeesBody')}
              icon={<Users size={24} color={INK[400]} />}
            />
          </Card>
        ) : (
          <>
            <View className="flex-row gap-3 mb-3">
              <StatTile
                label={t('manager.attendancePercent')}
                value={`${monthAttendancePct.toFixed(1)}%`}
                tone="brand"
                icon={<CalendarCheck size={16} color={BRAND[600]} />}
              />
              <StatTile
                label={t('common.team')}
                value={String(headcount)}
                icon={<Users size={16} color={INK[500]} />}
              />
            </View>

            <View className="flex-row gap-3 mb-6">
              <StatTile
                label={t('manager.lateInstances')}
                value={String(lateCount)}
                icon={<Clock size={16} color={INK[500]} />}
              />
              <StatTile
                label={t('manager.openObservations')}
                value={String(openObservations)}
                icon={<Wrench size={16} color={INK[500]} />}
              />
            </View>

            <Section title={t('manager.attendanceTrend')} subtitle={t('manager.attendanceTrendHint')}>
              <Card>
                {trend.length === 0 ? (
                  <EmptyState title={t('worker.noAttendanceThisMonth')} />
                ) : (
                  // Simple inline bars rather than a chart library: this is a
                  // 10-point series on a narrow phone screen, where a full
                  // chart adds weight without adding readability.
                  <View className="gap-2">
                    {trend.map(p => (
                      <View key={p.date} className="flex-row items-center gap-2">
                        <Text className="text-2xs text-ink-500 w-12 tabular-nums">{p.date.slice(5)}</Text>
                        <View className="flex-1 h-3 bg-ink-100 rounded-full overflow-hidden">
                          <View
                            className="h-3 bg-brand-600 rounded-full"
                            style={{ width: `${Math.min(100, (p.presentPct / maxTrend) * 100)}%` }}
                          />
                        </View>
                        <Text className="text-2xs text-ink-700 w-10 text-right tabular-nums">
                          {p.presentPct.toFixed(0)}%
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </Section>

            <Section title={t('manager.attendanceBreakdown')}>
              <Card>
                <View className="gap-2">
                  {Object.keys(statusLabels)
                    .filter(code => (statusCounts[code] ?? 0) > 0)
                    .map(code => (
                      <View key={code} className="flex-row justify-between items-center">
                        <Text className="text-sm text-ink-600">{statusLabels[code]}</Text>
                        <Text className="text-sm font-bold text-ink-900 tabular-nums">{statusCounts[code]}</Text>
                      </View>
                    ))}
                  {Object.values(statusCounts).every(v => !v) && (
                    <Text className="text-sm text-ink-500">{t('common.noData')}</Text>
                  )}
                </View>
              </Card>
            </Section>

            <Section title={t('common.approvals')}>
              <View className="flex-row gap-3">
                <StatTile label={t('common.leave')} value={String(pendingLeave)} helperText={t('common.pending')} />
                <StatTile label={t('common.advance')} value={String(pendingAdvance)} helperText={t('common.pending')} />
              </View>
            </Section>

            <Section title={t('manager.topPerformers')} subtitle={t('manager.topPerformersHint')}>
              <Card>
                {topScorers.length === 0 ? (
                  <EmptyState
                    title={t('manager.noScoresYet')}
                    message={t('manager.noScoresYetBody')}
                    icon={<FileText size={24} color={INK[400]} />}
                  />
                ) : (
                  <View className="gap-3">
                    {topScorers.map((s, i) => (
                      <View key={s.empCode || i} className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3 flex-1 pr-2">
                          <View className="w-7 h-7 rounded-full bg-ink-100 items-center justify-center">
                            <Text className="text-xs font-bold text-ink-600 tabular-nums">{i + 1}</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-ink-900" numberOfLines={1}>{s.name}</Text>
                            <Text className="text-2xs font-mono text-ink-500">{s.empCode}</Text>
                          </View>
                        </View>
                        <Text className="text-base font-bold text-brand-600 tabular-nums">{s.composite.toFixed(0)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  )
}
