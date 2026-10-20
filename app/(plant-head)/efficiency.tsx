import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { istMonthYear } from '@/lib/istDate'
import { BRAND, STATUS, INK } from '@/components/theme'
import { ChevronLeft, ChevronRight, X, Gauge, Factory, User } from 'lucide-react-native'

type Entry = {
  id: string; employee_id: string | null; efficiency_pct: number
  approval_status: string; note: string | null
}
type Emp = { id: string; emp_code: string; name: string }

/**
 * Worker production-allowance efficiency % — a MANUAL decision by the plant head
 * per the worker agreement (decided 20 Oct 2026). Never auto-derived.
 * Entries saved here are approved immediately: the plant head is the decider.
 */
export default function EfficiencyScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const now = istMonthYear()
  const [month, setMonth] = useState(Number(now.month))
  const [year, setYear] = useState(now.year)
  const [entries, setEntries] = useState<Entry[]>([])
  const [workers, setWorkers] = useState<Emp[]>([])
  const [empMap, setEmpMap] = useState<Record<string, Emp>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [plantPct, setPlantPct] = useState('')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Emp | null>(null)
  const [workerPct, setWorkerPct] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const payrollMonth = `${year}-${String(month).padStart(2, '0')}`

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const [{ data: emps }, { data: rows }] = await Promise.all([
      supabase.from('employees').select('id,emp_code,name,category').order('emp_code'),
      supabase.from('payroll_efficiency_entries').select('*').eq('payroll_month', payrollMonth).order('entered_at', { ascending: false }),
    ])
    const all = (emps ?? []) as (Emp & { category: string })[]
    setEmpMap(Object.fromEntries(all.map(e => [e.id, e])))
    setWorkers(all.filter(e => e.category === 'worker'))
    setEntries((rows ?? []) as Entry[])
    setIsLoading(false)
  }, [payrollMonth])

  useEffect(() => { refresh() }, [refresh])

  if (!employee) return <LoadingScreen />

  const shiftMonth = (d: number) => {
    let m = month + d, y = year
    if (m < 1) { m = 12; y-- } else if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }

  const validPct = (s: string) => s.trim() !== '' && !isNaN(Number(s)) && Number(s) >= 0 && Number(s) <= 150

  const upsert = async (employeeId: string | null, pct: number) => {
    const q = supabase.from('payroll_efficiency_entries').select('id')
      .eq('payroll_month', payrollMonth)
    const { data: existing } = employeeId
      ? await q.eq('employee_id', employeeId).maybeSingle()
      : await q.is('employee_id', null).maybeSingle()
    const stamp = { approval_status: 'approved', approved_by: employee.id, approved_at: new Date().toISOString() }
    if (existing) {
      return supabase.from('payroll_efficiency_entries').update({ efficiency_pct: pct, ...stamp }).eq('id', existing.id)
    }
    return supabase.from('payroll_efficiency_entries').insert({
      payroll_month: payrollMonth, employee_id: employeeId, efficiency_pct: pct,
      entered_by: employee.id, ...stamp,
    })
  }

  const save = async (key: string, employeeId: string | null, pctStr: string, doneKey: string) => {
    if (!validPct(pctStr)) { Alert.alert(t('common.error'), t('payroll.invalidPct')); return }
    setBusy(key)
    const { error } = await upsert(employeeId, Number(pctStr))
    setBusy(null)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    Alert.alert(t('common.success'), t(doneKey))
    if (employeeId === null) setPlantPct('')
    else { setPicked(null); setWorkerPct(''); setSearch('') }
    refresh()
  }

  const suggestions = search.trim().length < 2 ? [] : workers
    .filter(w => w.name.toLowerCase().includes(search.toLowerCase()) || w.emp_code.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 6)

  const inputCls = 'bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-base text-ink-900'

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-3">{t('payroll.efficiencyTitle')}</Text>

        <Card className="mb-3 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => shiftMonth(-1)} className="p-2"><ChevronLeft size={22} color={INK[500]} /></TouchableOpacity>
          <Text className="text-lg font-bold text-ink-900">{t(`payroll.months.${month}`)} {year}</Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} className="p-2"><ChevronRight size={22} color={INK[500]} /></TouchableOpacity>
        </Card>

        <Text className="text-xs text-ink-500 mb-3 px-1">{t('payroll.efficiencyMaxHint')} · {t('payroll.efficiencyAutoNote')}</Text>

        {/* Plant-wide */}
        <Card className="mb-4">
          <View className="flex-row items-center gap-2 mb-1">
            <Factory size={18} color={BRAND[600]} />
            <Text className="text-base font-bold text-ink-900">{t('payroll.plantWideLabel')}</Text>
          </View>
          <Text className="text-xs text-ink-500 mb-2">{t('payroll.plantWideHint')}</Text>
          <View className="flex-row gap-2 items-center">
            <TextInput className={`${inputCls} flex-1`} placeholder={t('payroll.efficiencyPctLabel')} placeholderTextColor={INK[400]}
              keyboardType="numeric" value={plantPct} onChangeText={setPlantPct} />
            <Button title="payroll.savePlantWide" variant="primary" size="md" loading={busy === 'plant'}
              onPress={() => save('plant', null, plantPct, 'payroll.savedPlantWide')} />
          </View>
        </Card>

        {/* Per-worker override */}
        <Card className="mb-4">
          <View className="flex-row items-center gap-2 mb-1">
            <User size={18} color={BRAND[600]} />
            <Text className="text-base font-bold text-ink-900">{t('payroll.overrideTitle')}</Text>
          </View>
          <Text className="text-xs text-ink-500 mb-2">{t('payroll.overrideHint')}</Text>
          {picked ? (
            <View className="flex-row items-center justify-between bg-brand-50 rounded-xl px-3 py-2 mb-2">
              <Text className="text-sm font-semibold text-brand-700">{picked.name} ({picked.emp_code})</Text>
              <TouchableOpacity onPress={() => setPicked(null)}><X size={16} color={BRAND[700]} /></TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput className={inputCls} placeholder={t('payroll.empSearchPlaceholder')} placeholderTextColor={INK[400]}
                value={search} onChangeText={setSearch} />
              {suggestions.map(w => (
                <TouchableOpacity key={w.id} onPress={() => { setPicked(w); setSearch('') }}
                  className="px-3 py-2 border-b border-ink-100">
                  <Text className="text-sm text-ink-900">{w.name} <Text className="text-ink-400 font-mono text-xs">{w.emp_code}</Text></Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          <View className="flex-row gap-2 items-center mt-2">
            <TextInput className={`${inputCls} flex-1`} placeholder={t('payroll.efficiencyPctLabel')} placeholderTextColor={INK[400]}
              keyboardType="numeric" value={workerPct} onChangeText={setWorkerPct} />
            <Button title="payroll.saveOverride" variant="secondary" size="md" loading={busy === 'worker'}
              onPress={() => picked
                ? save('worker', picked.id, workerPct, 'payroll.overrideSaved')
                : Alert.alert(t('common.error'), t('payroll.selectEmployee'))} />
          </View>
        </Card>

        {/* This month's entries */}
        <View className="flex-row items-center gap-2 mb-2 px-1">
          <Gauge size={16} color={INK[500]} />
          <Text className="text-sm font-bold text-ink-700">{t('payroll.currentEntries')}</Text>
        </View>
        {isLoading ? <ActivityIndicator color={BRAND[600]} /> : entries.length === 0 ? (
          <Text className="text-sm text-ink-400 text-center mt-4">{t('payroll.noEntries')}</Text>
        ) : entries.map(e => {
          const emp = e.employee_id ? empMap[e.employee_id] : null
          return (
            <Card key={e.id} className="mb-2 flex-row items-center justify-between">
              <View className="flex-1 mr-2">
                <Text className="text-sm font-semibold text-ink-900">
                  {e.employee_id ? (emp ? `${emp.name} (${emp.emp_code})` : '—') : t('payroll.plantWideBadge')}
                </Text>
                <Text className="text-xs font-semibold uppercase tracking-wider mt-0.5" style={{ color: STATUS.approved.fg }}>
                  {t(`common.${e.approval_status}`)}
                </Text>
              </View>
              <Text className="text-base font-bold text-brand-600 tabular-nums">{e.efficiency_pct}%</Text>
            </Card>
          )
        })}
      </ScrollView>
    </View>
  )
}
