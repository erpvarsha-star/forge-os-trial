import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Switch } from 'react-native'
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
const CODES: Code[] = ['P', 'L', 'HL', 'WO']

type Emp = { id: string; emp_code: string; name: string }
type ExistingRow = { entry_date: string; status: string | null; check_in_time: string | null; ot_hours: number | null; outstation_travel: boolean | null }

// Calendar-day shift on a YYYY-MM-DD string via UTC arithmetic (timezone-invariant),
// same pattern as components/PuneAttendance.tsx's shiftDate().
const shiftDate = (dateStr: string, days: number) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// First day of the month containing dateStr, as YYYY-MM-DD
const monthStartOf = (dateStr: string) => dateStr.slice(0, 7) + '-01'

// Shift a YYYY-MM-01 month-start string by whole months via UTC arithmetic
const shiftMonth = (monthStartStr: string, months: number) => {
  const [y, m] = monthStartStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10)
}

// All YYYY-MM-DD dates in the month containing monthStartStr
const datesInMonth = (monthStartStr: string): string[] => {
  const [y, m] = monthStartStr.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: daysInMonth }, (_, i) =>
    new Date(Date.UTC(y, m - 1, i + 1)).toISOString().slice(0, 10))
}

const monthLabel = (monthStartStr: string) => {
  const [y, m] = monthStartStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const CLERK_ERRORS: [string, string][] = [
  ['not an attendance clerk', 'puneClerk.notClerk'],
  ['employee not in your location', 'puneClerk.notYourLocation'],
  ['invalid status', 'puneClerk.invalidStatus'],
  ['date out of range', 'puneBulk.monthOutOfRange'],
  ['no entries provided', 'puneBulk.noChanges'],
]

const parseOt = (txt: string): number | null => {
  const v = txt.trim().replace(',', '.')
  if (v === '') return 0
  if (!/^\d+(\.\d+)?$/.test(v)) return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 24 || (n * 2) % 1 !== 0) return null
  return n
}

export function PuneBulkAttendance() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const today = istDateStr()
  // Default to the previous calendar month (the real catch-up case: "enter
  // all of October" on any day in November) — the earliest month the
  // pune_bulk_set_attendance RPC accepts.
  const earliestMonth = shiftMonth(monthStartOf(today), -1)
  const latestMonth = monthStartOf(today)

  const [emps, setEmps] = useState<Emp[]>([])
  const [loadingEmps, setLoadingEmps] = useState(true)
  const [notClerk, setNotClerk] = useState(false)
  const [selectedEmp, setSelectedEmp] = useState<Emp | null>(null)
  const [month, setMonth] = useState(earliestMonth)
  const [existing, setExisting] = useState<Record<string, ExistingRow>>({})
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [edits, setEdits] = useState<Record<string, Code>>({})
  const [otEdits, setOtEdits] = useState<Record<string, string>>({})
  const [travelEdits, setTravelEdits] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const clerkMessage = (msg: string) => {
    const hit = CLERK_ERRORS.find(([needle]) => msg.includes(needle))
    return hit ? t(hit[1]) : t('puneClerk.generic', { message: msg })
  }

  // Load the clerk's employee roster once, via the existing roster RPC
  // (reusing today's roster just for the employee list, per the brief's
  // "prefer reusing what exists" guidance).
  useEffect(() => {
    (async () => {
      setLoadingEmps(true)
      const { data, error } = await supabase.rpc('pune_attendance_roster', { p_date: today })
      if (error) {
        setNotClerk(error.message.includes('not an attendance clerk'))
        setLoadingEmps(false)
        return
      }
      setNotClerk(false)
      const rows = (data ?? []) as { employee_id: string; emp_code: string; name: string }[]
      setEmps(rows.map(r => ({ id: r.employee_id, emp_code: r.emp_code, name: r.name })))
      setLoadingEmps(false)
    })()
  }, [today])

  const loadMonth = useCallback(async () => {
    if (!selectedEmp) return
    setLoadingMonth(true)
    setEdits({}); setOtEdits({}); setTravelEdits({})
    const { data, error } = await supabase.rpc('pune_bulk_attendance_status', {
      p_employee_id: selectedEmp.id, p_month: month,
    })
    if (error) {
      Alert.alert(t('common.error'), clerkMessage(error.message))
      setExisting({})
      setLoadingMonth(false)
      return
    }
    const map: Record<string, ExistingRow> = {}
    for (const r of (data ?? []) as ExistingRow[]) map[r.entry_date] = r
    setExisting(map)
    setLoadingMonth(false)
  }, [selectedEmp, month, t])

  useEffect(() => { loadMonth() }, [loadMonth])

  const dates = useMemo(() => datesInMonth(month), [month])
  const canGoPrevMonth = month > earliestMonth
  const canGoNextMonth = month < latestMonth

  const statusOf = (d: string) => (edits[d] ?? existing[d]?.status) as Code | undefined
  const savedOt = (d: string) => Number(existing[d]?.ot_hours ?? 0) || 0
  const savedTravel = (d: string) => !!existing[d]?.outstation_travel
  const otText = (d: string) => otEdits[d] ?? (savedOt(d) > 0 ? String(savedOt(d)) : '')
  const travelOn = (d: string) => travelEdits[d] ?? savedTravel(d)
  const otChanged = (d: string) => d in otEdits && parseOt(otEdits[d]) !== savedOt(d)
  const travelChanged = (d: string) => d in travelEdits && travelEdits[d] !== savedTravel(d)
  const isPunched = (d: string) => !!existing[d]?.check_in_time

  const changedDates = dates.filter(d =>
    !isPunched(d) && (
      (d in edits && edits[d] !== existing[d]?.status) || otChanged(d) || travelChanged(d)
    ))

  const rowError = (d: string): string | null => {
    const ot = d in otEdits ? parseOt(otEdits[d]) : savedOt(d)
    if (d in otEdits && parseOt(otEdits[d]) === null) return t('puneClerk.otInvalid')
    if (!statusOf(d) && ((ot ?? 0) > 0 || travelOn(d))) return t('puneClerk.statusFirst')
    return null
  }
  const hasErrors = changedDates.some(d => rowError(d))

  const save = async () => {
    if (!selectedEmp || !changedDates.length) return
    Alert.alert(
      t('puneBulk.saveConfirmTitle'),
      t('puneBulk.saveConfirmBody', { count: changedDates.length, name: selectedEmp.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.save'), onPress: doSave },
      ]
    )
  }

  const doSave = async () => {
    if (!selectedEmp) return
    setSaving(true)
    const entries = changedDates.map(d => ({
      date: d,
      status: statusOf(d),
      ot_hours: parseOt(otText(d)) ?? 0,
      outstation_travel: travelOn(d),
    }))
    const { data, error } = await supabase.rpc('pune_bulk_set_attendance', {
      p_employee_id: selectedEmp.id, p_entries: entries,
    })
    setSaving(false)
    if (error) {
      Alert.alert(t('common.error'), clerkMessage(error.message))
      return
    }
    const rows = (data ?? []) as { entry_date: string; applied: boolean; reason: string | null }[]
    const appliedCount = rows.filter(r => r.applied).length
    const skippedCount = rows.filter(r => !r.applied).length
    if (appliedCount === 0) {
      Alert.alert(t('puneBulk.saveResultTitle'), t('puneBulk.noEntriesApplied'))
    } else {
      const lines = [t('puneBulk.appliedCount', { count: appliedCount })]
      if (skippedCount > 0) lines.push(t('puneBulk.skippedCount', { count: skippedCount }))
      Alert.alert(t('puneBulk.saveResultTitle'), lines.join('\n'))
    }
    loadMonth()
  }

  if (!employee) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-1">{t('puneBulk.title')}</Text>
        <Text className="text-sm text-ink-500 mb-3">{t('puneBulk.subtitle')}</Text>

        {loadingEmps ? (
          <ActivityIndicator color={BRAND[600]} />
        ) : notClerk ? (
          <Text className="text-sm text-ink-500 px-1">{t('puneClerk.notClerk')}</Text>
        ) : emps.length === 0 ? (
          <Text className="text-sm text-ink-500 px-1">{t('hrAdmin.puneNoEmployees')}</Text>
        ) : (
          <>
            <Card className="mb-3">
              <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('puneBulk.pickEmployee')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {emps.map(e => (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => setSelectedEmp(e)}
                    className={`px-3 py-2 rounded-lg border ${selectedEmp?.id === e.id ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-200'}`}
                  >
                    <Text className={`text-sm font-bold ${selectedEmp?.id === e.id ? 'text-white' : 'text-ink-900'}`}>{e.name}</Text>
                    <Text className={`text-2xs font-mono ${selectedEmp?.id === e.id ? 'text-white' : 'text-ink-500'}`}>{e.emp_code}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            {selectedEmp && (
              <>
                <Card className="mb-3 flex-row items-center justify-between">
                  <TouchableOpacity disabled={!canGoPrevMonth} onPress={() => setMonth(shiftMonth(month, -1))} className="p-2" style={{ opacity: canGoPrevMonth ? 1 : 0.3 }}>
                    <ChevronLeft size={22} color={INK[500]} />
                  </TouchableOpacity>
                  <Text className="text-lg font-bold text-ink-900">{monthLabel(month)}</Text>
                  <TouchableOpacity disabled={!canGoNextMonth} onPress={() => setMonth(shiftMonth(month, 1))} className="p-2" style={{ opacity: canGoNextMonth ? 1 : 0.3 }}>
                    <ChevronRight size={22} color={INK[500]} />
                  </TouchableOpacity>
                </Card>

                <View className="flex-row items-start gap-2 mb-3 bg-white border border-ink-100 rounded-xl p-3">
                  <Info size={16} color={INK[500]} />
                  <Text className="text-xs text-ink-600 flex-1">{t('puneBulk.monthOutOfRange')}</Text>
                </View>

                {loadingMonth ? (
                  <ActivityIndicator color={BRAND[600]} />
                ) : (
                  <>
                    {dates.map(d => {
                      const punched = isPunched(d)
                      const current = statusOf(d)
                      return (
                        <Card key={d} className="mb-2">
                          <Text className="text-sm font-bold text-ink-900 mb-2">{d}</Text>
                          {punched ? (
                            <Text className="text-sm text-ink-500">{t('puneBulk.alreadyPunched')} — {existing[d]?.status}</Text>
                          ) : (
                            <>
                              <View className="flex-row gap-2">
                                {CODES.map(c => (
                                  <TouchableOpacity key={c} onPress={() => setEdits(prev => ({ ...prev, [d]: c }))}
                                    className={`flex-1 items-center py-2 rounded-lg border ${current === c ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-200'}`}>
                                    <Text className={`text-sm font-bold ${current === c ? 'text-white' : 'text-ink-700'}`}>{c}</Text>
                                    <Text className={`text-2xs ${current === c ? 'text-white' : 'text-ink-500'}`}>{t(`hrAdmin.puneStatus.${c}`)}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                              <View className="mt-3">
                                <View className="flex-row items-center gap-3">
                                  <View className="flex-1">
                                    <Text className="text-xs text-ink-600 mb-1">{t('puneClerk.otHours')}</Text>
                                    <TextInput
                                      value={otText(d)}
                                      onChangeText={v => setOtEdits(prev => ({ ...prev, [d]: v }))}
                                      keyboardType="decimal-pad" placeholder="0"
                                      className="border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink-900 bg-white" />
                                  </View>
                                  <View className="flex-1 items-start">
                                    <Text className="text-xs text-ink-600 mb-1">{t('puneClerk.outstation')}</Text>
                                    <Switch value={travelOn(d)} trackColor={{ true: BRAND[600] }}
                                      onValueChange={v => setTravelEdits(prev => ({ ...prev, [d]: v }))} />
                                  </View>
                                </View>
                                {rowError(d) && <Text className="text-xs text-red-600 mt-1">{rowError(d)}</Text>}
                              </View>
                            </>
                          )}
                        </Card>
                      )
                    })}
                    <Button title="puneBulk.saveMonth" variant="primary" size="lg" className="mt-2" loading={saving}
                      disabled={!changedDates.length || hasErrors} onPress={save} />
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}
