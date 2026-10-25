import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { istDateStr } from '@/lib/istDate'
import { BRAND, INK } from '@/components/theme'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react-native'

type Code = 'P' | 'L' | 'HL' | 'WO'
// No absent chip — absent means no row, and HR-entered rows cannot be deleted (no DELETE policy)
const CODES: Code[] = ['P', 'L', 'HL', 'WO']
const MAX_DAYS_BACK = 7

type Emp = { id: string; emp_code: string; name: string }
type Rec = { status: string; check_in_time: string | null }

// Calendar-day shift on a YYYY-MM-DD string via UTC arithmetic (timezone-invariant, not a "what day is it" read)
const shiftDate = (dateStr: string, days: number) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// Punched time of day in IST, HH:MM
const istTime = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(11, 16)

export default function PuneAttendanceScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const today = istDateStr()
  const [date, setDate] = useState(today)
  const [emps, setEmps] = useState<Emp[]>([])
  const [existing, setExisting] = useState<Record<string, Rec>>({})
  const [edits, setEdits] = useState<Record<string, Code>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setEdits({})
    const { data: people } = await supabase.from('employees').select('id, emp_code, name')
      .eq('is_active', true).eq('work_location', 'Pune').order('emp_code')
    const list = (people ?? []) as Emp[]
    setEmps(list)
    const map: Record<string, Rec> = {}
    if (list.length) {
      const { data: recs } = await supabase.from('attendance_records').select('employee_id, status, check_in_time')
        .eq('date', date).in('employee_id', list.map(e => e.id))
      for (const r of recs ?? []) map[(r as any).employee_id] = { status: (r as any).status, check_in_time: (r as any).check_in_time }
    }
    setExisting(map)
    setIsLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  if (!employee) return <LoadingScreen />

  const canGoBack = date > shiftDate(today, -MAX_DAYS_BACK)
  const canGoForward = date < today
  const changedIds = Object.keys(edits).filter(id => edits[id] !== (existing[id]?.status as Code | undefined))

  const save = async () => {
    if (!changedIds.length) return
    setSaving(true)
    // Only changed rows; check_in_time is deliberately left out so it stays null on HR-entered rows
    const rows = changedIds.map(id => ({ employee_id: id, date, status: edits[id] }))
    const { error } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'employee_id,date' })
    setSaving(false)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    Alert.alert(t('common.success'), t('hrAdmin.puneSaved', { count: rows.length }))
    load()
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-3">{t('hrAdmin.puneAttendance')}</Text>

        <Card className="mb-3 flex-row items-center justify-between">
          <TouchableOpacity disabled={!canGoBack} onPress={() => setDate(shiftDate(date, -1))} className="p-2" style={{ opacity: canGoBack ? 1 : 0.3 }}>
            <ChevronLeft size={22} color={INK[500]} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-ink-900">{date}</Text>
          <TouchableOpacity disabled={!canGoForward} onPress={() => setDate(shiftDate(date, 1))} className="p-2" style={{ opacity: canGoForward ? 1 : 0.3 }}>
            <ChevronRight size={22} color={INK[500]} />
          </TouchableOpacity>
        </Card>

        <View className="flex-row items-start gap-2 mb-3 bg-white border border-ink-100 rounded-xl p-3">
          <Info size={16} color={INK[500]} />
          <Text className="text-xs text-ink-600 flex-1">{t('hrAdmin.puneReminderNote')}</Text>
        </View>

        {isLoading ? <ActivityIndicator color={BRAND[600]} /> : emps.length === 0 ? (
          <Text className="text-sm text-ink-500 px-1">{t('hrAdmin.puneNoEmployees')}</Text>
        ) : (
          <>
            {emps.map(e => {
              const rec = existing[e.id]
              const punched = !!rec?.check_in_time
              const current = (edits[e.id] ?? rec?.status) as Code | undefined
              return (
                <Card key={e.id} className="mb-2">
                  <Text className="text-base font-bold text-ink-900">{e.name}</Text>
                  <Text className="text-xs font-mono text-ink-500 mb-2">{e.emp_code}</Text>
                  {punched ? (
                    <Text className="text-sm text-ink-700">
                      {t('hrAdmin.punchedAt', { time: istTime(rec.check_in_time!) })} — {rec.status}
                    </Text>
                  ) : (
                    <View className="flex-row gap-2">
                      {CODES.map(c => (
                        <TouchableOpacity key={c} onPress={() => setEdits(prev => ({ ...prev, [e.id]: c }))}
                          className={`flex-1 items-center py-2 rounded-lg border ${current === c ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-200'}`}>
                          <Text className={`text-sm font-bold ${current === c ? 'text-white' : 'text-ink-700'}`}>{c}</Text>
                          <Text className={`text-2xs ${current === c ? 'text-white' : 'text-ink-500'}`}>{t(`hrAdmin.puneStatus.${c}`)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </Card>
              )
            })}
            <Button title="common.save" variant="primary" size="lg" className="mt-2" loading={saving}
              disabled={!changedIds.length} onPress={save} />
          </>
        )}
      </ScrollView>
    </View>
  )
}
