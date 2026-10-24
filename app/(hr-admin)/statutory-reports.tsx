import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Redirect } from 'expo-router'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { istMonthYear } from '@/lib/istDate'
import { BRAND, STATUS, INK } from '@/components/theme'
import { ChevronLeft, ChevronRight, Download, AlertTriangle } from 'lucide-react-native'
import { mergeRows, buildPfEcr, buildEsi, buildPt, buildMlwf, isMlwfMonth, StatRow } from '@/lib/statutory'

// Only fully finalized runs: statutory returns must never be filed on numbers that can still change.
const REPORTABLE = ['finalized', 'payment_file_generated', 'paid', 'archived']
const RANK: Record<string, number> = { finalized: 1, payment_file_generated: 2, paid: 3, archived: 4 }
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const daysIn = (month: number, year: number) => new Date(Date.UTC(year, month, 0)).getUTCDate() // pure calendar arithmetic, not "today"

interface Period { month: number; year: number; status: string }
type Loaded = { periods: Period[]; byPeriod: Record<string, StatRow[]> }

export default function StatutoryReportsScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [data, setData] = useState<Loaded | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sel, setSel] = useState<{ month: number; year: number } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data: periods, error: e1 } = await supabase.from('pay_periods').select('id, month, year')
      if (e1) throw e1
      const { data: runs, error: e2 } = await supabase.from('pay_runs').select('id, status, pay_period_id').in('status', REPORTABLE)
      if (e2) throw e2
      const pById = new Map((periods ?? []).map((p: any) => [p.id, p]))
      const runPeriod = new Map<string, string>()
      const best: Record<string, string> = {}
      for (const r of runs ?? []) {
        const p: any = pById.get((r as any).pay_period_id)
        if (!p) continue
        const key = `${Number(p.year)}-${Number(p.month)}`
        runPeriod.set((r as any).id, key)
        if (!best[key] || RANK[(r as any).status] < RANK[best[key]]) best[key] = (r as any).status // show the least-final status
      }
      const items: any[] = []
      for (const ids of chunk([...runPeriod.keys()], 20)) {
        let from = 0
        for (;;) {
          const { data: part, error: e3 } = await supabase.from('pay_run_items').select('pay_run_id, employee_id, snapshot').in('pay_run_id', ids).range(from, from + 999)
          if (e3) throw e3
          items.push(...(part ?? []))
          if ((part ?? []).length < 1000) break
          from += 1000
        }
      }
      const empIds = [...new Set(items.map((i) => i.employee_id))]
      const emps = new Map<string, any>(), sal = new Map<string, any>()
      for (const ids of chunk(empIds, 80)) {
        const { data: er, error: e4 } = await supabase.from('employees').select('id, emp_code, name, gender, pt_exempt').in('id', ids)
        if (e4) throw e4
        for (const e of er ?? []) emps.set((e as any).id, e)
        const { data: sr, error: e5 } = await supabase.from('employee_salary_structure').select('employee_id, uan, esi_no, effective_from').in('employee_id', ids).eq('is_active', true).order('effective_from', { ascending: true })
        if (e5) throw e5
        for (const s of sr ?? []) sal.set((s as any).employee_id, s) // ascending order: latest wins
      }
      const grouped: Record<string, StatRow[]> = {}
      for (const it of items) {
        const e = emps.get(it.employee_id)
        if (!e) continue
        const s = sal.get(it.employee_id)
        const snap = it.snapshot ?? {}
        ;(grouped[runPeriod.get(it.pay_run_id)!] ??= []).push({
          empCode: e.emp_code, name: e.name, gender: e.gender, ptExempt: !!e.pt_exempt,
          uan: s?.uan ?? null, esiNo: s?.esi_no ?? null, category: snap.category ?? null,
          worked: snap.worked ?? 0, earnings: snap.earnings ?? {}, deductions: snap.deductions ?? {}, totalEarnings: snap.totalEarnings ?? 0,
        })
      }
      const byPeriod: Record<string, StatRow[]> = {}
      for (const [k, rows] of Object.entries(grouped)) byPeriod[k] = mergeRows(rows)
      const list: Period[] = Object.keys(best).map((k) => { const [y, m] = k.split('-').map(Number); return { month: m, year: y, status: best[k] } })
        .sort((a, b) => b.year - a.year || b.month - a.month)
      setData({ periods: list, byPeriod })
      const cur = istMonthYear()
      const pick = list.find((p) => p.month === Number(cur.month) && p.year === cur.year) ?? list[0]
      if (pick) setSel((s) => s ?? { month: pick.month, year: pick.year })
    } catch (e: any) { setError(e?.message ?? String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => (data && sel ? data.byPeriod[`${sel.year}-${sel.month}`] ?? [] : []), [data, sel])
  const period = data?.periods.find((p) => sel && p.month === sel.month && p.year === sel.year)
  const pf = useMemo(() => (sel ? buildPfEcr(rows, daysIn(sel.month, sel.year)) : null), [rows, sel])
  const esi = useMemo(() => (sel ? buildEsi(rows) : null), [rows, sel])
  const pt = useMemo(() => (sel ? buildPt(rows, sel.month) : null), [rows, sel])
  const mlwf = useMemo(() => {
    if (!data || !sel || !isMlwfMonth(sel.month)) return null
    const monthly: Record<number, StatRow[]> = {}
    for (let m = 1; m <= 12; m++) monthly[m] = data.byPeriod[`${sel.year}-${m}`] ?? []
    return buildMlwf(monthly, sel.month)
  }, [data, sel])

  const step = (d: number) => {
    if (!data || !sel) return
    const i = data.periods.findIndex((p) => p.month === sel.month && p.year === sel.year)
    const n = data.periods[i - d] // list is newest-first
    if (n) setSel({ month: n.month, year: n.year })
  }

  if (!employee) return <LoadingScreen />
  if (!['hr_admin', 'owner'].includes(employee.role)) return <Redirect href="/" />

  const share = async (kind: string, content: string, ext: 'csv' | 'txt') => {
    if (!sel) return
    setBusy(kind)
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error(t('statutory.shareFailed'))
      const uri = `${FileSystem.cacheDirectory}${kind}_${sel.year}_${String(sel.month).padStart(2, '0')}.${ext}`
      await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 })
      await Sharing.shareAsync(uri, { mimeType: ext === 'csv' ? 'text/csv' : 'text/plain', dialogTitle: t(`statutory.${kind}Title`) })
    } catch (e: any) { Alert.alert(t('common.error'), e?.message ?? String(e)) }
    finally { setBusy(null) }
  }

  const Warn = ({ text }: { text: string }) => (
    <View className="flex-row items-start gap-2 mt-2">
      <AlertTriangle size={16} color={STATUS.pending.fg} />
      <Text className="flex-1 text-xs text-ink-700">{text}</Text>
    </View>
  )
  const Stat = ({ label, value }: { label: string; value: string }) => (
    <View className="flex-row justify-between py-0.5"><Text className="text-sm text-ink-500">{label}</Text><Text className="text-sm font-semibold text-ink-900">{value}</Text></View>
  )
  const DownloadBtn = ({ kind, content, ext, disabled }: { kind: string; content: string; ext: 'csv' | 'txt'; disabled?: boolean }) => (
    <TouchableOpacity
      disabled={disabled || busy !== null}
      onPress={() => share(kind, content, ext)}
      className={`mt-3 flex-row items-center justify-center gap-2 rounded-xl py-3 ${disabled ? 'bg-ink-100' : 'bg-brand-600'}`}
    >
      {busy === kind ? <ActivityIndicator color="#fff" /> : <Download size={18} color={disabled ? INK[300] : '#fff'} />}
      <Text className={`font-semibold ${disabled ? 'text-ink-300' : 'text-white'}`}>{t('statutory.download')} (.{ext})</Text>
    </TouchableOpacity>
  )

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-3">{t('statutory.title')}</Text>

        {loading ? <ActivityIndicator color={BRAND[600]} className="my-8" /> : null}
        {error ? <Card className="mb-4"><Text className="text-sm text-red-600">{error}</Text></Card> : null}
        {!loading && !error && (!data || data.periods.length === 0) ? <Card className="mb-4"><Text className="text-sm text-ink-500">{t('statutory.noRuns')}</Text></Card> : null}

        {sel && period ? (
          <>
            <Card className="mb-4 flex-row items-center justify-between">
              <TouchableOpacity onPress={() => step(-1)} className="p-2"><ChevronLeft size={22} color={INK[500]} /></TouchableOpacity>
              <View className="items-center">
                <Text className="text-lg font-bold text-ink-900">{t(`payroll.months.${sel.month}`)} {sel.year}</Text>
                <Text className="text-xs font-semibold mt-0.5" style={{ color: BRAND[600] }}>{t('statutory.runStatus')}: {period.status.replace(/_/g, ' ')}</Text>
              </View>
              <TouchableOpacity onPress={() => step(1)} className="p-2"><ChevronRight size={22} color={INK[500]} /></TouchableOpacity>
            </Card>

            <Card className="mb-4" title={t('statutory.pfTitle')}>
              <Stat label={t('statutory.members')} value={String(pf?.totals.members ?? 0)} />
              <Stat label={t('statutory.epfWages')} value={inr(pf?.totals.epfWages ?? 0)} />
              <Stat label={t('statutory.epfEe')} value={inr(pf?.totals.epfEe ?? 0)} />
              <Stat label={t('statutory.eps')} value={inr(pf?.totals.eps ?? 0)} />
              <Stat label={t('statutory.erDiff')} value={inr(pf?.totals.diff ?? 0)} />
              {pf && pf.missingUan.length ? <Warn text={t('statutory.missingUan', { count: pf.missingUan.length, list: pf.missingUan.join(', ') })} /> : null}
              {pf && pf.mismatches.length ? <Warn text={t('statutory.pfMismatch', { count: pf.mismatches.length, list: pf.mismatches.join(', ') })} /> : null}
              <DownloadBtn kind="pf" content={pf?.text ?? ''} ext="txt" disabled={!pf?.rows.length} />
            </Card>

            <Card className="mb-4" title={t('statutory.esiTitle')}>
              <Stat label={t('statutory.members')} value={String(esi?.totals.members ?? 0)} />
              <Stat label={t('statutory.wages')} value={inr(esi?.totals.wages ?? 0)} />
              <Stat label={t('statutory.ipShare')} value={inr(esi?.totals.ip ?? 0)} />
              <Stat label={t('statutory.erShare')} value={inr(esi?.totals.er ?? 0)} />
              {esi && esi.missingEsiNo.length ? <Warn text={t('statutory.missingEsi', { count: esi.missingEsiNo.length, list: esi.missingEsiNo.join(', ') })} /> : null}
              <DownloadBtn kind="esi" content={esi?.csv ?? ''} ext="csv" disabled={!esi?.rows.length} />
            </Card>

            <Card className="mb-4" title={t('statutory.ptTitle')}>
              <Stat label={t('statutory.members')} value={String(pt?.totals.members ?? 0)} />
              <Stat label={t('statutory.ptDeducted')} value={inr(pt?.totals.pt ?? 0)} />
              <Stat label={t('statutory.ptExpected')} value={inr(pt?.totals.expected ?? 0)} />
              {pt && pt.mismatches.length ? <Warn text={t('statutory.ptMismatch', { count: pt.mismatches.length, list: pt.mismatches.join(', ') })} /> : null}
              <DownloadBtn kind="pt" content={pt?.csv ?? ''} ext="csv" disabled={!pt?.rows.length} />
            </Card>

            <Card className="mb-4" title={t('statutory.mlwfTitle')}>
              {mlwf ? (
                <>
                  <Stat label={t('statutory.members')} value={String(mlwf.totals.members)} />
                  <Stat label={t('statutory.mlwfTotal')} value={inr(mlwf.totals.amount)} />
                  <DownloadBtn kind="mlwf" content={mlwf.csv} ext="csv" disabled={!mlwf.rows.length} />
                </>
              ) : <Text className="text-sm text-ink-500">{t('statutory.mlwfNotPayable')}</Text>}
            </Card>

            <Text className="text-xs text-ink-500 leading-5">{t('statutory.disclaimer')}</Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}
