import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { PayRunWarning, PayRunWarningDecision, reviewWarning } from '@/lib/payroll/client'
import { BRAND, INK } from '@/components/theme'
import { AlertTriangle, Info } from 'lucide-react-native'

type RunOption = { id: string; name: string; status: string }

const CHIP: Record<PayRunWarningDecision, { bg: string; fg: string }> = {
  pending: { bg: '#FEF3C7', fg: '#B45309' },
  waived: { bg: '#E5E7EB', fg: '#4B5563' },
  deduct: { bg: '#FEE2E2', fg: '#B91C1C' },
}

export default function PayrollWarningsScreen() {
  const { t, i18n } = useTranslation()
  const { employee } = useAuth()
  const params = useLocalSearchParams<{ runId?: string }>()
  const [runs, setRuns] = useState<RunOption[]>([])
  const [runId, setRunId] = useState<string | null>(params.runId ?? null)
  const [warnings, setWarnings] = useState<PayRunWarning[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [pendingOnly, setPendingOnly] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [reviewingIds, setReviewingIds] = useState<string[]>([])

  // Runs for the picker, newest first; default to the newest unless a run was passed in
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('pay_runs').select('id, name, status')
        .neq('status', 'cancelled').order('created_at', { ascending: false }).limit(12)
      const list = (data ?? []) as RunOption[]
      setRuns(list)
      setRunId(cur => cur ?? list[0]?.id ?? null)
      if (!list.length) setIsLoading(false)
    })()
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!runId) return
    if (!silent) setIsLoading(true)
    const { data } = await supabase.from('pay_run_warnings')
      .select('*, agent_verdict, agent_notes, agent_reviewed_at')
      .eq('run_id', runId).order('employee_code', { ascending: true })
    const rows = (data ?? []) as PayRunWarning[]
    setWarnings(rows)
    const codes = Array.from(new Set(rows.map(r => r.employee_code)))
    if (codes.length) {
      const { data: emps } = await supabase.from('employees').select('emp_code, name').in('emp_code', codes)
      const map: Record<string, string> = {}
      for (const e of emps ?? []) map[(e as any).emp_code] = (e as any).name
      setNames(map)
    }
    setIsLoading(false)
  }, [runId])

  useEffect(() => { load() }, [load])

  const pendingCount = warnings.filter(w => w.decision === 'pending').length
  const awaitingCount = warnings.filter(w => w.decision !== 'pending' && !w.agent_reviewed_at).length
  const grouped = useMemo(() => {
    const shown = pendingOnly ? warnings.filter(w => w.decision === 'pending') : warnings
    const m = new Map<string, PayRunWarning[]>()
    for (const w of shown) m.set(w.employee_code, [...(m.get(w.employee_code) ?? []), w])
    return Array.from(m.entries())
  }, [warnings, pendingOnly])

  if (!employee) return <LoadingScreen />

  const decide = async (w: PayRunWarning, decision: 'waived' | 'deduct') => {
    setSavingId(w.id)
    // decided_at is a real UTC instant for a timestamptz column — correct as a plain ISO string
    const decided_at = new Date().toISOString()
    const { error } = await supabase.from('pay_run_warnings')
      .update({ decision, decided_by: employee.emp_code, decided_at }).eq('id', w.id)
    setSavingId(null)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setWarnings(prev => prev.map(x => x.id === w.id ? { ...x, decision, decided_by: employee.emp_code, decided_at, agent_verdict: null, agent_notes: null, agent_reviewed_at: null } : x))
    runReview(w.id)
  }

  // Not awaited by decide(): the UI stays usable while the AI reviews. A failure just leaves the card on
  // "Awaiting AI review" with a Retry button, so errors are swallowed after the refetch.
  const runReview = async (warningId: string) => {
    setReviewingIds(prev => [...prev, warningId])
    try { await reviewWarning(warningId) } catch { /* shown as awaiting review + retry */ }
    await load(true)
    setReviewingIds(prev => prev.filter(x => x !== warningId))
  }

  // "2025-10-07" -> "07 Oct" without any Date/timezone conversion
  const fmtDate = (d: string) => {
    const [, m, day] = String(d).split('-')
    const mi = Number(m)
    if (!mi || mi > 12) return String(d)
    const name = t(`payroll.months.${mi}`)
    return `${day} ${i18n.language?.startsWith('en') ? name.slice(0, 3) : name}`
  }

  const lateBlock = (w: PayRunWarning) => {
    const d = w.detail ?? {}
    const kind = d.kind === 'over_30' ? t('payroll.warnKindOver30') : t('payroll.warnKindOverFreeQuota')
    return (
      <View className="mt-1">
        <Text className="text-xs text-ink-900 font-semibold">
          {d.date ? fmtDate(d.date) : ''} · {t('payroll.warnLateMinutes', { count: d.late_minutes ?? 0 })}
        </Text>
        <Text className="text-xs text-ink-600">{kind}{d.nth_free_late ? ` (${t('payroll.warnNthFree', { n: d.nth_free_late })})` : ''}</Text>
        <Text className="text-xs text-ink-600">{t('payroll.warnReason')}: {d.late_reason ? String(d.late_reason) : t('payroll.warnNoReason')}</Text>
      </View>
    )
  }

  const reviewBlock = (w: PayRunWarning) => {
    if (w.decision === 'pending') return null
    if (reviewingIds.includes(w.id)) {
      return (
        <View className="flex-row items-center gap-2 mt-2">
          <ActivityIndicator size="small" color={BRAND[600]} />
          <Text className="text-xs text-ink-600">{t('payroll.warnAiReviewing')}</Text>
        </View>
      )
    }
    if (w.agent_reviewed_at) {
      const ok = w.agent_verdict === 'agree'
      return (
        <View className="mt-2">
          <View className="self-start rounded-full px-2.5 py-0.5" style={{ backgroundColor: ok ? '#DCFCE7' : '#FEE2E2' }}>
            <Text className="text-xs font-bold" style={{ color: ok ? '#15803D' : '#B91C1C' }}>{t(ok ? 'payroll.warnAgreed' : 'payroll.warnConcern')}</Text>
          </View>
          {w.agent_notes ? <Text className="text-xs text-ink-600 mt-1">{w.agent_notes}</Text> : null}
        </View>
      )
    }
    return (
      <View className="mt-2">
        <Text className="text-xs text-amber-700">{t('payroll.warnAwaitingReview')}</Text>
        <TouchableOpacity onPress={() => runReview(w.id)} className="self-start mt-1 px-3 py-1 rounded-full border border-ink-200 bg-white">
          <Text className="text-xs font-semibold text-ink-700">{t('payroll.warnRetryReview')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Readable one-liner for a warning's detail jsonb: arrays as lists, scalars as "key: value"
  const describe = (w: PayRunWarning) => {
    const d = w.detail ?? {}
    const parts: string[] = []
    for (const [k, v] of Object.entries(d)) {
      if (v == null || v === '') continue
      if (Array.isArray(v)) parts.push(`${t(`payroll.warnDetail.${k}`, { defaultValue: k })}: ${v.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(', ')}`)
      else if (typeof v === 'object') parts.push(`${t(`payroll.warnDetail.${k}`, { defaultValue: k })}: ${JSON.stringify(v)}`)
      else parts.push(`${t(`payroll.warnDetail.${k}`, { defaultValue: k })}: ${String(v)}`)
    }
    return parts.join('\n')
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-1">{t('payroll.warnTitle')}</Text>
        <Text className="text-sm text-ink-600">{t('payroll.warnPendingCount', { count: pendingCount })}</Text>
        <Text className="text-sm text-ink-600 mb-3">{t('payroll.warnAwaitingCount', { count: awaitingCount })}</Text>

        {runs.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {runs.map(r => (
              <TouchableOpacity key={r.id} onPress={() => setRunId(r.id)}
                className={`mr-2 px-3 py-1.5 rounded-full border ${runId === r.id ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-200'}`}>
                <Text className={`text-xs font-semibold ${runId === r.id ? 'text-white' : 'text-ink-700'}`}>{r.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View className="flex-row gap-2 mb-3">
          {([true, false] as const).map(p => (
            <TouchableOpacity key={String(p)} onPress={() => setPendingOnly(p)}
              className={`px-3 py-1.5 rounded-full border ${pendingOnly === p ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-200'}`}>
              <Text className={`text-xs font-semibold ${pendingOnly === p ? 'text-white' : 'text-ink-700'}`}>
                {t(p ? 'payroll.warnFilterPending' : 'payroll.warnFilterAll')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="flex-row items-start gap-2 mb-3 bg-white border border-ink-100 rounded-xl p-3">
          <Info size={16} color={INK[500]} />
          <Text className="text-xs text-ink-600 flex-1">{t('payroll.warnDeductInfo')}</Text>
        </View>

        {isLoading ? <ActivityIndicator color={BRAND[600]} /> : grouped.length === 0 ? (
          <Card className="items-center py-8">
            <AlertTriangle size={28} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-2">{t('payroll.warnEmpty')}</Text>
          </Card>
        ) : grouped.map(([code, items]) => (
          <Card key={code} className="mb-3">
            <Text className="text-base font-bold text-ink-900">{names[code] ?? code}</Text>
            <Text className="text-xs font-mono text-ink-500 mb-1">{code}</Text>
            {items.map(w => (
              <View key={w.id} className="border-t border-ink-100 pt-2 mt-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-ink-900 flex-1 pr-2">{t(`payroll.warnType.${w.warning_type}`, { defaultValue: w.warning_type })}</Text>
                  <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: CHIP[w.decision].bg }}>
                    <Text className="text-xs font-bold" style={{ color: CHIP[w.decision].fg }}>{t(`payroll.warnDecision.${w.decision}`)}</Text>
                  </View>
                </View>
                {w.warning_type === 'late_excess'
                  ? lateBlock(w)
                  : describe(w) ? <Text className="text-xs text-ink-600 mt-1">{describe(w)}</Text> : null}
                <View className="flex-row gap-2 mt-2">
                  <View className="flex-1">
                    <Button title="payroll.warnWaive" variant={w.decision === 'waived' ? 'primary' : 'secondary'} size="sm"
                      loading={savingId === w.id} onPress={() => decide(w, 'waived')} />
                  </View>
                  <View className="flex-1">
                    <Button title="payroll.warnDeduct" variant={w.decision === 'deduct' ? 'danger' : 'secondary'} size="sm"
                      loading={savingId === w.id} onPress={() => decide(w, 'deduct')} />
                  </View>
                </View>
                {reviewBlock(w)}
              </View>
            ))}
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
