import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { istDateStr, istYesterdayStr } from '@/lib/istDate'
import { BRAND, INK } from '@/components/theme'
import { AlertTriangle } from 'lucide-react-native'

type Emp = { id: string; emp_code: string; name: string; department: string | null; is_active: boolean }
type Hist = { status: string; effective_from: string; note: string | null; created_at: string }

const STATUSES = ['left', 'terminated', 'retired', 'on_leave', 'active'] as const
type Status = (typeof STATUSES)[number]
const EXIT_STATUSES: Status[] = ['left', 'terminated', 'retired']

// Strict YYYY-MM-DD that round-trips to a real calendar date (rejects 2026-02-31)
const isValidDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export default function EmployeeExitScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [emps, setEmps] = useState<Emp[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Emp | null>(null)
  const [status, setStatus] = useState<Status>('left')
  const [date, setDate] = useState(istDateStr())
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<Hist[]>([])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('employees').select('id,emp_code,name,department,is_active').order('emp_code')
      // Active employees first, as exits are almost always for someone currently active
      setEmps(((data ?? []) as Emp[]).sort((a, b) => Number(b.is_active) - Number(a.is_active)))
      setIsLoading(false)
    })()
  }, [])

  const loadHistory = useCallback(async (empId: string) => {
    const { data } = await supabase
      .from('employee_status_history').select('status,effective_from,note,created_at')
      .eq('employee_id', empId).order('created_at', { ascending: false }).limit(10)
    setHistory((data ?? []) as Hist[])
  }, [])

  useEffect(() => { if (picked) loadHistory(picked.id); else setHistory([]) }, [picked, loadHistory])

  if (!employee) return <LoadingScreen />

  const q = search.trim().toLowerCase()
  const matches = emps
    .filter(e => q === '' || e.name.toLowerCase().includes(q) || e.emp_code.toLowerCase().includes(q))
    .slice(0, 8)

  const isExit = EXIT_STATUSES.includes(status)
  const dateOk = isValidDate(date)
  const inputCls = 'bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-base text-ink-900'
  const chip = (active: boolean) => `px-3 py-2 rounded-full border ${active ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-200'}`

  const startSave = () => {
    if (!picked) { Alert.alert(t('common.error'), t('payroll.exitSelectFirst')); return }
    if (!dateOk) { Alert.alert(t('common.error'), t('payroll.exitInvalidDate')); return }
    setConfirming(true)
  }

  const save = async () => {
    if (!picked) return
    setSaving(true)
    const { error } = await supabase.rpc('record_employee_status', {
      p_employee_id: picked.id, p_status: status, p_date: date, p_note: note.trim() || null,
    })
    setSaving(false)
    setConfirming(false)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    Alert.alert(t('common.success'), t('payroll.exitSaved'))
    setNote('')
    loadHistory(picked.id)
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-3">{t('payroll.exitTitle')}</Text>

        {isLoading ? <ActivityIndicator color={BRAND[600]} /> : (
          <>
            {/* Employee picker */}
            {picked ? (
              <Card className="mb-3 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-xs text-ink-500">{t('payroll.exitSelected')}</Text>
                  <Text className="text-base font-bold text-ink-900">{picked.name}</Text>
                  <Text className="text-xs font-mono text-ink-500">{picked.emp_code}{picked.department ? ` · ${picked.department}` : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => { setPicked(null); setConfirming(false) }} className="p-2">
                  <Text className="text-sm font-semibold text-brand-600">{t('payroll.exitChange')}</Text>
                </TouchableOpacity>
              </Card>
            ) : (
              <Card className="mb-3">
                <TextInput value={search} onChangeText={setSearch} placeholder={t('payroll.exitSearch')} className={inputCls} autoCapitalize="none" />
                {matches.length === 0 ? (
                  <Text className="text-sm text-ink-500 mt-2">{t('payroll.exitNoMatch')}</Text>
                ) : matches.map(e => (
                  <TouchableOpacity key={e.id} onPress={() => setPicked(e)} className="py-2.5 border-b border-ink-100 min-h-touch justify-center">
                    <Text className="text-base text-ink-900">{e.name}{e.is_active ? '' : `  (${t('payroll.exitInactiveTag')})`}</Text>
                    <Text className="text-xs font-mono text-ink-500">{e.emp_code}{e.department ? ` · ${e.department}` : ''}</Text>
                  </TouchableOpacity>
                ))}
              </Card>
            )}

            {/* Status + date */}
            <Card className="mb-3">
              <Text className="text-sm font-semibold text-ink-900 mb-2">{t('payroll.exitStatusLabel')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {STATUSES.map(s => (
                  <TouchableOpacity key={s} onPress={() => { setStatus(s); setConfirming(false) }} className={chip(status === s)}>
                    <Text className={`text-sm font-semibold ${status === s ? 'text-white' : 'text-ink-800'}`}>{t(`payroll.exitStatus_${s}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-sm font-semibold text-ink-900 mt-4 mb-2">{isExit ? t('payroll.lastWorkingDay') : t('payroll.effectiveDate')}</Text>
              <View className="flex-row gap-2 mb-2">
                <TouchableOpacity onPress={() => setDate(istDateStr())} className={chip(date === istDateStr())}>
                  <Text className={`text-sm font-semibold ${date === istDateStr() ? 'text-white' : 'text-ink-800'}`}>{t('payroll.dateToday')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDate(istYesterdayStr())} className={chip(date === istYesterdayStr())}>
                  <Text className={`text-sm font-semibold ${date === istYesterdayStr() ? 'text-white' : 'text-ink-800'}`}>{t('payroll.dateYesterday')}</Text>
                </TouchableOpacity>
              </View>
              <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" maxLength={10}
                className={`${inputCls} font-mono`} />
              {!dateOk && <Text className="text-xs text-red-600 mt-1">{t('payroll.exitInvalidDate')}</Text>}

              <TextInput value={note} onChangeText={setNote} placeholder={t('payroll.exitNote')} className={`${inputCls} mt-3`} />

              {isExit && (
                <View className="flex-row items-start gap-2 mt-3">
                  <AlertTriangle size={14} color="#B45309" />
                  <Text className="text-xs text-amber-700 flex-1">{t('payroll.exitHint')}</Text>
                </View>
              )}

              {confirming && picked ? (
                <View className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <Text className="text-sm font-bold text-amber-700">{t('payroll.exitConfirmTitle')}</Text>
                  <Text className="text-sm text-amber-700 mt-1">
                    {t('payroll.exitConfirmBody', { name: picked.name, code: picked.emp_code, status: t(`payroll.exitStatus_${status}`), date })}
                  </Text>
                  <View className="flex-row gap-2 mt-3">
                    <View className="flex-1"><Button title="common.cancel" variant="secondary" size="md" onPress={() => setConfirming(false)} /></View>
                    <View className="flex-1"><Button title="common.confirm" variant="danger" size="md" loading={saving} onPress={save} /></View>
                  </View>
                </View>
              ) : (
                <Button title="payroll.exitSave" variant="primary" size="md" className="mt-4" onPress={startSave} />
              )}
            </Card>

            {/* History */}
            {picked && (
              <>
                <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('payroll.exitHistory')}</Text>
                {history.length === 0 ? (
                  <Text className="text-sm text-ink-500 px-1">{t('payroll.exitNoHistory')}</Text>
                ) : history.map((h, i) => (
                  <Card key={`${h.created_at}-${i}`} className="mb-2">
                    <View className="flex-row justify-between">
                      <Text className="text-base font-semibold text-ink-900">{t(`payroll.exitStatus_${h.status}`, { defaultValue: h.status })}</Text>
                      <Text className="text-sm font-mono text-ink-600">{h.effective_from}</Text>
                    </View>
                    {h.note ? <Text className="text-xs text-ink-500 mt-1">{h.note}</Text> : null}
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}
