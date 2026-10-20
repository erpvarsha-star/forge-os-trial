import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { payrollRun, exportPayRun, PAYROLL_MONTH_LABEL, CalculateResult, RunSummary } from '@/lib/payroll/client'
import { buildSalarySheetCsv, buildBankFileCsv } from '@/lib/payroll/exportCsv'
import { istMonthYear } from '@/lib/istDate'
import { BRAND, STATUS, INK } from '@/components/theme'
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, AlertTriangle, Play, Send, Stamp, IndianRupee, Download } from 'lucide-react-native'

type Run = { id: string; status: string; name: string }

const EXPORTABLE = ['finalized', 'payment_file_generated', 'paid', 'archived']

const FEED_TABLES = [
  { key: 'canteen', table: 'payroll_canteen_entries' },
  { key: 'society', table: 'payroll_society_recoveries' },
  { key: 'efficiency', table: 'payroll_efficiency_entries' },
  { key: 'adjustments', table: 'payroll_adjustments' },
] as const

export default function PayrollRunScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { employee } = useAuth()
  const now = istMonthYear()
  const [month, setMonth] = useState(Number(now.month))
  const [year, setYear] = useState(now.year)
  const [run, setRun] = useState<Run | null>(null)
  const [pendingFeeds, setPendingFeeds] = useState<Record<string, number>>({})
  const [summary, setSummary] = useState<RunSummary | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const payrollMonth = `${year}-${String(month).padStart(2, '0')}`

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const { data: period } = await supabase
      .from('pay_periods').select('id')
      .eq('month', String(month).padStart(2, '0')).eq('year', String(year)).maybeSingle()
    let r: Run | null = null
    if (period) {
      const { data: runs } = await supabase
        .from('pay_runs').select('id, status, name')
        .eq('pay_period_id', period.id).neq('status', 'cancelled')
        .order('created_at', { ascending: false }).limit(1)
      r = runs?.[0] ?? null
    }
    setRun(r)
    const counts: Record<string, number> = {}
    for (const f of FEED_TABLES) {
      const { count } = await supabase
        .from(f.table).select('id', { count: 'exact', head: true })
        .eq('payroll_month', payrollMonth).eq('approval_status', 'pending')
      counts[f.key] = count ?? 0
    }
    setPendingFeeds(counts)
    if (r && ['calculated', 'in_review', 'approved', 'finalized', 'payment_file_generated', 'paid', 'archived'].includes(r.status)) {
      try { setSummary(await payrollRun<RunSummary>('summary', { payRunId: r.id })) } catch { setSummary(null) }
    } else setSummary(null)
    setIsLoading(false)
  }, [month, year, payrollMonth])

  useEffect(() => { refresh() }, [refresh])

  if (!employee) return <LoadingScreen />

  const shiftMonth = (d: number) => {
    let m = month + d, y = year
    if (m < 1) { m = 12; y-- } else if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }

  const act = async (key: string, fn: () => Promise<any>, confirmMsg?: string) => {
    const go = async () => {
      setBusy(key)
      try { await fn(); await refresh() }
      catch (e: any) { Alert.alert(t('common.error'), e.message ?? String(e)) }
      finally { setBusy(null) }
    }
    if (confirmMsg) Alert.alert(t('common.confirm'), confirmMsg, [{ text: t('common.cancel') }, { text: t('common.confirm'), onPress: go }])
    else go()
  }

  const exportFile = (kind: 'salary' | 'bank') => act(`export-${kind}`, async () => {
    if (!run || !EXPORTABLE.includes(run.status)) throw new Error(t('payroll.exportNotReady'))
    if (!(await Sharing.isAvailableAsync())) throw new Error(t('payroll.exportFailed'))
    let data
    try { data = await exportPayRun(run.id) } catch (e: any) {
      throw new Error(e?.detail?.error?.includes?.('finalized') ? t('payroll.exportNotReady') : t('payroll.exportFailed'))
    }
    const label = PAYROLL_MONTH_LABEL(data.month, data.year).replace(' ', '_')
    let csv: string, missing: string[] = []
    if (kind === 'salary') csv = buildSalarySheetCsv(data.salaryRows)
    else { const b = buildBankFileCsv(data.bankRows, data.month, data.year); csv = b.csv; missing = b.missingBank }
    const uri = `${FileSystem.cacheDirectory}${kind === 'salary' ? 'salary_sheet' : 'bank_file'}_${label}.csv`
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 })
    if (missing.length) Alert.alert(t('common.warning'), t('payroll.bankMissingWarning', { count: missing.length }))
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: t(kind === 'salary' ? 'payroll.downloadSalarySheet' : 'payroll.downloadBankFile') })
  })

  const totalPending = Object.values(pendingFeeds).reduce((a, b) => a + b, 0)
  const isOct2026 = month === 10 && year === 2026
  const statusColor = run?.status === 'finalized' || run?.status === 'paid' ? STATUS.approved.fg : BRAND[600]

  const StepRow = ({ done, label, hint }: { done: boolean; label: string; hint?: string }) => (
    <View className="flex-row items-center gap-3 py-2">
      {done ? <CheckCircle2 size={20} color={STATUS.approved.fg} /> : <Circle size={20} color={INK[300]} />}
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink-900">{label}</Text>
        {hint ? <Text className="text-xs text-ink-500 mt-0.5">{hint}</Text> : null}
      </View>
    </View>
  )

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-3">{t('payroll.title')}</Text>

        <Card className="mb-4 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => shiftMonth(-1)} className="p-2"><ChevronLeft size={22} color={INK[500]} /></TouchableOpacity>
          <Text className="text-lg font-bold text-ink-900">{t(`payroll.months.${month}`)} {year}</Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} className="p-2"><ChevronRight size={22} color={INK[500]} /></TouchableOpacity>
        </Card>

        {isLoading ? <ActivityIndicator color={BRAND[600]} /> : (
          <>
            {/* Step 1 — feeds */}
            <Card className="mb-3">
              <StepRow done={totalPending === 0} label={t('payroll.stepFeeds')}
                hint={totalPending > 0 ? t('payroll.feedsPending', { count: totalPending }) : t('payroll.feedsReady')} />
              <Button title="payroll.openFeeds" variant="secondary" size="md" className="mt-1"
                onPress={() => router.push('/(hr-admin)/payroll-feeds' as any)} />
            </Card>

            {/* Step 2 — run + calculate */}
            <Card className="mb-3">
              <StepRow done={!!run} label={t('payroll.stepRun')}
                hint={run ? `${run.name} — ${t(`payroll.status.${run.status}`)}` : t('payroll.noRun')} />
              {run ? (
                <View className="mt-1 px-1">
                  <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: statusColor }}>
                    {t(`payroll.status.${run.status}`)}
                  </Text>
                </View>
              ) : (
                <Button title="payroll.createRun" variant="primary" size="md" className="mt-1" loading={busy === 'create'}
                  onPress={() => act('create', () => payrollRun('create', { month, year }))} />
              )}
              {run?.status === 'draft' && (
                <Button title="payroll.calculate" variant="primary" size="md" className="mt-2" loading={busy === 'calc'}
                  icon={<Play size={18} color="white" />}
                  onPress={() => act('calc',
                    async () => {
                      const r = await payrollRun<CalculateResult>('calculate', { payRunId: run.id })
                      Alert.alert(t('payroll.calculated', { count: r.calculated }),
                        (r.held.length ? t('payroll.heldNote', { count: r.held.length }) + '\n' : '')
                        + (r.warnings.length ? t('payroll.warningsNote', { count: r.warnings.length }) : ''))
                    }, t('payroll.calculateConfirm'))} />
              )}
            </Card>

            {/* Step 3 — arrears (Oct 2026 only) */}
            {isOct2026 && run && ['calculated', 'in_review'].includes(run.status) && (
              <Card className="mb-3">
                <StepRow done={!!summary?.arrearsSep2630} label={t('payroll.stepArrears')} hint={t('payroll.arrearsHint')} />
                {!summary?.arrearsSep2630 && (
                  <Button title="payroll.attachArrears" variant="secondary" size="md" className="mt-1" loading={busy === 'arr'}
                    onPress={() => act('arr', async () => {
                      const r = await payrollRun<{ written: number }>('arrears_sep26_30', { payRunId: run.id })
                      Alert.alert(t('common.success'), t('payroll.arrearsDone', { count: r.written }))
                    }, t('payroll.arrearsConfirm'))} />
                )}
              </Card>
            )}

            {/* Step 4 — review / approve / finalize */}
            {run && ['calculated', 'in_review', 'approved'].includes(run.status) && (
              <Card className="mb-3">
                <StepRow done={false} label={t('payroll.stepReview')} />
                {run.status === 'calculated' && (
                  <Button title="payroll.moveToReview" variant="secondary" size="md" className="mt-1" loading={busy === 'tr'}
                    icon={<Send size={16} color={BRAND[600]} />}
                    onPress={() => act('tr', () => payrollRun('transition', { payRunId: run.id, to: 'in_review' }))} />
                )}
                {run.status === 'in_review' && (
                  <Button title="payroll.approveRun" variant="primary" size="md" className="mt-1" loading={busy === 'tr'}
                    icon={<Stamp size={16} color="white" />}
                    onPress={() => act('tr', () => payrollRun('transition', { payRunId: run.id, to: 'approved' }), t('payroll.approveConfirm'))} />
                )}
                {run.status === 'approved' && (
                  <Button title="payroll.finalizeRun" variant="primary" size="md" className="mt-1" loading={busy === 'tr'}
                    onPress={() => act('tr', () => payrollRun('transition', { payRunId: run.id, to: 'finalized' }), t('payroll.finalizeConfirm'))} />
                )}
              </Card>
            )}

            {/* Downloads — finished runs only */}
            {run && EXPORTABLE.includes(run.status) && (
              <Card className="mb-3">
                <Button title="payroll.downloadSalarySheet" variant="secondary" size="md" loading={busy === 'export-salary'}
                  icon={<Download size={16} color={BRAND[600]} />} onPress={() => exportFile('salary')} />
                <Button title="payroll.downloadBankFile" variant="secondary" size="md" className="mt-2" loading={busy === 'export-bank'}
                  icon={<Download size={16} color={BRAND[600]} />} onPress={() => exportFile('bank')} />
              </Card>
            )}

            {/* Summary */}
            {summary && (
              <Card>
                <View className="flex-row items-center gap-2 mb-2">
                  <IndianRupee size={18} color={BRAND[600]} />
                  <Text className="text-base font-bold text-ink-900">{t('payroll.summaryTitle')}</Text>
                </View>
                <View className="gap-2">
                  <View className="flex-row justify-between"><Text className="text-sm text-ink-600">{t('payroll.summaryEmployees')}</Text><Text className="text-sm font-bold text-ink-900 tabular-nums">{summary.employees}</Text></View>
                  <View className="flex-row justify-between"><Text className="text-sm text-ink-600">{t('payroll.summaryGross')}</Text><Text className="text-sm font-bold text-ink-900 font-mono tabular-nums">₹{Math.round(summary.gross).toLocaleString('en-IN')}</Text></View>
                  {summary.arrearsSep2630 ? (
                    <View className="flex-row justify-between"><Text className="text-sm text-ink-600">{t('payroll.summaryArrears')}</Text><Text className="text-sm font-bold text-ink-900 font-mono tabular-nums">₹{Math.round(summary.arrearsSep2630).toLocaleString('en-IN')}</Text></View>
                  ) : null}
                  <View className="flex-row justify-between"><Text className="text-sm font-semibold text-ink-900">{t('payroll.summaryNet')}</Text><Text className="text-base font-bold text-brand-600 font-mono tabular-nums">₹{Math.round(summary.net).toLocaleString('en-IN')}</Text></View>
                </View>
              </Card>
            )}

            {totalPending > 0 && (
              <View className="flex-row items-center gap-2 mt-3 px-1">
                <AlertTriangle size={14} color="#B45309" />
                <Text className="text-xs text-amber-700 flex-1">{t('payroll.gateHint')}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}
