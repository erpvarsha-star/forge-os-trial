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
import { ChevronLeft, ChevronRight, Check, X, UtensilsCrossed, Landmark, SlidersHorizontal, Gauge } from 'lucide-react-native'

type TabKey = 'canteen' | 'society' | 'adjustments' | 'efficiency'
const TABS: { key: TabKey; table: string; Icon: any }[] = [
  { key: 'canteen', table: 'payroll_canteen_entries', Icon: UtensilsCrossed },
  { key: 'society', table: 'payroll_society_recoveries', Icon: Landmark },
  { key: 'adjustments', table: 'payroll_adjustments', Icon: SlidersHorizontal },
  { key: 'efficiency', table: 'payroll_efficiency_entries', Icon: Gauge },
]
const ADJ_TYPES = ['ARREARS', 'DISPATCH_INCENTIVE', 'OTHER_ALLOWANCE', 'OTHER_DEDUCTION', 'ENCASHMENT'] as const

type Emp = { id: string; emp_code: string; name: string }

export default function PayrollFeedsScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const now = istMonthYear()
  const [month, setMonth] = useState(Number(now.month))
  const [year, setYear] = useState(now.year)
  const [tab, setTab] = useState<TabKey>('canteen')
  const [entries, setEntries] = useState<any[]>([])
  const [empMap, setEmpMap] = useState<Record<string, Emp>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  // add-entry form
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Emp | null>(null)
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [adjType, setAdjType] = useState<(typeof ADJ_TYPES)[number]>('ARREARS')
  const [societyName, setSocietyName] = useState('')
  const [emiGeneral, setEmiGeneral] = useState('')
  const [emiEmergency, setEmiEmergency] = useState('')
  const [emiEducation, setEmiEducation] = useState('')
  const [sharesOther, setSharesOther] = useState('')
  const [saving, setSaving] = useState(false)

  const payrollMonth = `${year}-${String(month).padStart(2, '0')}`
  const table = TABS.find(x => x.key === tab)!.table

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const { data: emps } = await supabase.from('employees').select('id,emp_code,name').order('emp_code')
    setEmpMap(Object.fromEntries((emps ?? []).map((e: Emp) => [e.id, e])))
    const { data } = await supabase.from(table).select('*').eq('payroll_month', payrollMonth).order('entered_at', { ascending: false })
    setEntries(data ?? [])
    setIsLoading(false)
  }, [table, payrollMonth])

  useEffect(() => { refresh() }, [refresh])

  if (!employee) return <LoadingScreen />

  const shiftMonth = (d: number) => {
    let m = month + d, y = year
    if (m < 1) { m = 12; y-- } else if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }

  const setStatus = async (id: string, status: 'approved' | 'rejected') => {
    setBusyId(id)
    const { error } = await supabase.from(table).update({
      approval_status: status, approved_by: employee.id, approved_at: new Date().toISOString(),
    }).eq('id', id)
    setBusyId(null)
    if (error) Alert.alert(t('common.error'), error.message)
    else refresh()
  }

  const num = (s: string) => (s.trim() === '' ? 0 : Number(s))
  const validAmount = (s: string) => s.trim() !== '' && !isNaN(Number(s))

  const save = async () => {
    if (!picked) { Alert.alert(t('common.error'), t('payroll.selectEmployee')); return }
    const base = { payroll_month: payrollMonth, employee_id: picked.id, entered_by: employee.id }
    let payload: any
    if (tab === 'canteen') {
      if (!validAmount(amount) || Number(amount) < 0) { Alert.alert(t('common.error'), t('payroll.amount')); return }
      payload = { ...base, amount_inr: Number(amount), remarks: remarks || null }
    } else if (tab === 'society') {
      const total = num(emiGeneral) + num(emiEmergency) + num(emiEducation) + num(sharesOther)
      if (total <= 0) { Alert.alert(t('common.error'), t('payroll.amount')); return }
      payload = {
        ...base, society_name: societyName || null,
        general_emi_inr: num(emiGeneral), emergency_emi_inr: num(emiEmergency),
        education_emi_inr: num(emiEducation), shares_other_inr: num(sharesOther),
        remarks: remarks || null,
      }
    } else if (tab === 'adjustments') {
      if (!validAmount(amount) || Number(amount) === 0) { Alert.alert(t('common.error'), t('payroll.signedAmountHint')); return }
      if (!remarks.trim()) { Alert.alert(t('common.error'), t('payroll.reasonPlaceholder')); return }
      payload = { ...base, adjustment_type: adjType, signed_amount_inr: Number(amount), reason: remarks.trim() }
    } else return
    setSaving(true)
    const { error } = await supabase.from(table).insert(payload)
    setSaving(false)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    Alert.alert(t('common.success'), t('payroll.entrySaved'))
    setPicked(null); setSearch(''); setAmount(''); setRemarks(''); setSocietyName('')
    setEmiGeneral(''); setEmiEmergency(''); setEmiEducation(''); setSharesOther('')
    refresh()
  }

  const suggestions = search.trim().length < 2 ? [] : Object.values(empMap)
    .filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.emp_code.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 6)

  const statusColor = (s: string) => s === 'approved' ? STATUS.approved.fg : s === 'rejected' ? STATUS.rejected.fg : STATUS.pending.fg

  const amountText = (e: any) => {
    if (tab === 'canteen') return `₹${Number(e.amount_inr).toLocaleString('en-IN')}`
    if (tab === 'society') return `₹${Number(e.total_recovery_inr).toLocaleString('en-IN')}`
    if (tab === 'adjustments') return `${Number(e.signed_amount_inr) >= 0 ? '+' : '−'}₹${Math.abs(Number(e.signed_amount_inr)).toLocaleString('en-IN')}`
    return `${e.efficiency_pct}%`
  }

  const titleText = (e: any) => {
    if (tab === 'efficiency' && !e.employee_id) return t('payroll.plantWideBadge')
    const emp = e.employee_id ? empMap[e.employee_id] : null
    return emp ? `${emp.name} (${emp.emp_code})` : '—'
  }

  const subText = (e: any) => {
    if (tab === 'society' && e.society_name) return e.society_name
    if (tab === 'adjustments') return `${t(`payroll.adjTypes.${e.adjustment_type}`)} — ${e.reason ?? ''}`
    return e.remarks ?? e.note ?? ''
  }

  const inputCls = 'bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-base text-ink-900'

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-3">{t('payroll.feedsTitle')}</Text>

        <Card className="mb-3 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => shiftMonth(-1)} className="p-2"><ChevronLeft size={22} color={INK[500]} /></TouchableOpacity>
          <Text className="text-lg font-bold text-ink-900">{t(`payroll.months.${month}`)} {year}</Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} className="p-2"><ChevronRight size={22} color={INK[500]} /></TouchableOpacity>
        </Card>

        <View className="flex-row gap-2 mb-3">
          {TABS.map(({ key, Icon }) => (
            <TouchableOpacity key={key} onPress={() => setTab(key)}
              className={`flex-1 items-center py-2 rounded-xl border ${tab === key ? 'bg-brand-50 border-brand-500' : 'bg-white border-ink-200'}`}>
              <Icon size={16} color={tab === key ? BRAND[600] : INK[400]} />
              <Text className={`text-[11px] mt-1 font-semibold ${tab === key ? 'text-brand-600' : 'text-ink-500'}`}>
                {t(`payroll.tab${key[0].toUpperCase()}${key.slice(1)}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-xs text-ink-500 mb-3 px-1">{t(`payroll.${tab}Hint`)}</Text>

        {/* Add entry (efficiency is plant-head-only input) */}
        {tab !== 'efficiency' && (
          <Card className="mb-4">
            <Text className="text-base font-bold text-ink-900 mb-2">{t('payroll.addEntry')}</Text>
            {picked ? (
              <View className="flex-row items-center justify-between bg-brand-50 rounded-xl px-3 py-2 mb-2">
                <Text className="text-sm font-semibold text-brand-700">{picked.name} ({picked.emp_code})</Text>
                <TouchableOpacity onPress={() => setPicked(null)}><X size={16} color={BRAND[700]} /></TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput className={inputCls} placeholder={t('payroll.empSearchPlaceholder')} placeholderTextColor={INK[400]}
                  value={search} onChangeText={setSearch} />
                {suggestions.map(e => (
                  <TouchableOpacity key={e.id} onPress={() => { setPicked(e); setSearch('') }}
                    className="px-3 py-2 border-b border-ink-100">
                    <Text className="text-sm text-ink-900">{e.name} <Text className="text-ink-400 font-mono text-xs">{e.emp_code}</Text></Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {tab === 'adjustments' && (
              <View className="flex-row flex-wrap gap-2 mt-2">
                {ADJ_TYPES.map(k => (
                  <TouchableOpacity key={k} onPress={() => setAdjType(k)}
                    className={`px-3 py-1.5 rounded-full border ${adjType === k ? 'bg-brand-50 border-brand-500' : 'bg-white border-ink-200'}`}>
                    <Text className={`text-xs font-semibold ${adjType === k ? 'text-brand-600' : 'text-ink-500'}`}>{t(`payroll.adjTypes.${k}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {tab === 'society' ? (
              <View className="gap-2 mt-2">
                <TextInput className={inputCls} placeholder={t('payroll.societyName')} placeholderTextColor={INK[400]} value={societyName} onChangeText={setSocietyName} />
                <View className="flex-row gap-2">
                  <TextInput className={`${inputCls} flex-1`} placeholder={t('payroll.emiGeneral')} placeholderTextColor={INK[400]} keyboardType="numeric" value={emiGeneral} onChangeText={setEmiGeneral} />
                  <TextInput className={`${inputCls} flex-1`} placeholder={t('payroll.emiEmergency')} placeholderTextColor={INK[400]} keyboardType="numeric" value={emiEmergency} onChangeText={setEmiEmergency} />
                </View>
                <View className="flex-row gap-2">
                  <TextInput className={`${inputCls} flex-1`} placeholder={t('payroll.emiEducation')} placeholderTextColor={INK[400]} keyboardType="numeric" value={emiEducation} onChangeText={setEmiEducation} />
                  <TextInput className={`${inputCls} flex-1`} placeholder={t('payroll.sharesOther')} placeholderTextColor={INK[400]} keyboardType="numeric" value={sharesOther} onChangeText={setSharesOther} />
                </View>
              </View>
            ) : (
              <TextInput className={`${inputCls} mt-2`} placeholder={tab === 'adjustments' ? `${t('payroll.amount')} — ${t('payroll.signedAmountHint')}` : t('payroll.amount')}
                placeholderTextColor={INK[400]} keyboardType="numeric" value={amount} onChangeText={setAmount} />
            )}

            <TextInput className={`${inputCls} mt-2`} placeholder={tab === 'adjustments' ? t('payroll.reasonPlaceholder') : t('payroll.remarksPlaceholder')}
              placeholderTextColor={INK[400]} value={remarks} onChangeText={setRemarks} />
            <Button title="payroll.saveEntry" variant="primary" size="md" className="mt-3" loading={saving} onPress={save} />
          </Card>
        )}

        {/* Entries list */}
        {isLoading ? <ActivityIndicator color={BRAND[600]} /> : entries.length === 0 ? (
          <Text className="text-sm text-ink-400 text-center mt-6">{t('payroll.noEntries')}</Text>
        ) : entries.map(e => (
          <Card key={e.id} className="mb-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-2">
                <Text className="text-sm font-semibold text-ink-900">{titleText(e)}</Text>
                {subText(e) ? <Text className="text-xs text-ink-500 mt-0.5">{subText(e)}</Text> : null}
              </View>
              <Text className="text-sm font-bold text-ink-900 font-mono tabular-nums">{amountText(e)}</Text>
            </View>
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: statusColor(e.approval_status) }}>
                {t(`common.${e.approval_status}`)}
              </Text>
              {e.approval_status === 'pending' && (
                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={() => setStatus(e.id, 'approved')} disabled={busyId === e.id}
                    className="flex-row items-center gap-1 px-3 py-1.5 rounded-full" style={{ backgroundColor: STATUS.approved.bg }}>
                    <Check size={14} color={STATUS.approved.fg} />
                    <Text className="text-xs font-semibold" style={{ color: STATUS.approved.fg }}>{t('payroll.approveAction')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setStatus(e.id, 'rejected')} disabled={busyId === e.id}
                    className="flex-row items-center gap-1 px-3 py-1.5 rounded-full" style={{ backgroundColor: STATUS.rejected.bg }}>
                    <X size={14} color={STATUS.rejected.fg} />
                    <Text className="text-xs font-semibold" style={{ color: STATUS.rejected.fg }}>{t('payroll.rejectAction')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
