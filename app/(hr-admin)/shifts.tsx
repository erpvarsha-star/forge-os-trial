import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Shift, Employee } from '@/types'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native'
import { BRAND, INK } from '@/components/theme'

// Returns the YYYY-MM-DD of the most recent Saturday in IST, offset by weekOffset weeks.
// Saturday = DOW 6 (JS getDay). daysBack = (dow - 6 + 7) % 7.
const getWeekStartIST = (weekOffset: number): string => {
  const istMs = Date.now() + 5.5 * 60 * 60 * 1000
  const istNow = new Date(istMs)
  const dow = istNow.getUTCDay()
  const daysBack = (dow - 6 + 7) % 7
  const satMs = istMs - daysBack * 86_400_000 + weekOffset * 7 * 86_400_000
  return new Date(satMs).toISOString().slice(0, 10)
}

// Returns 6 date strings Sat–Thu (the work week, Friday off).
const getWeekDays = (weekStart: string): string[] => {
  const days: string[] = []
  const base = new Date(weekStart + 'T00:00:00Z')
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getTime() + i * 86_400_000)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

const fmtWeekLabel = (weekStart: string): string => {
  const base = new Date(weekStart + 'T00:00:00Z')
  const end = new Date(base.getTime() + 5 * 86_400_000)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${fmt(base)} – ${fmt(end)}`
}

export default function ShiftsScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [weekOffset, setWeekOffset] = useState(0)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [workers, setWorkers] = useState<Employee[]>([])
  const [security, setSecurity] = useState<Employee[]>([])
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const weekStart = getWeekStartIST(weekOffset)
  const weekDays = getWeekDays(weekStart)
  const weekEnd = weekDays[weekDays.length - 1]

  const rotatingShifts = shifts.filter(s => ['Shift 1', 'Shift 2', 'Shift 3'].includes(s.name))
  const securityShifts = shifts.filter(s => ['Security Day', 'Security Night'].includes(s.name))

  const loadData = useCallback(async () => {
    setIsLoading(true)

    const [{ data: sData }, { data: eData }, { data: assignData }] = await Promise.all([
      supabase.from('shifts').select('*').order('start_time'),
      supabase
        .from('employees')
        .select('id, name, emp_code, role, category')
        .eq('is_active', true)
        .or("category.in.(worker),role.in.(supervisor,security_guard)"),
      // Load first day of week to pre-populate selections
      supabase
        .from('employee_shifts')
        .select('employee_id, shift_id')
        .eq('date', weekStart),
    ])

    if (sData) setShifts(sData as Shift[])
    if (eData) {
      const all = eData as Employee[]
      setWorkers(all.filter(e => e.role !== 'security_guard'))
      setSecurity(all.filter(e => e.role === 'security_guard'))
    }

    if (assignData) {
      const sel: Record<string, string> = {}
      assignData.forEach((row: { employee_id: string; shift_id: string }) => {
        sel[row.employee_id] = row.shift_id
      })
      setSelections(sel)
    }

    setIsLoading(false)
  }, [weekStart])

  useEffect(() => { loadData() }, [loadData])

  const select = (employeeId: string, shiftId: string) => {
    setSelections(prev => {
      if (prev[employeeId] === shiftId) {
        const next = { ...prev }
        delete next[employeeId]
        return next
      }
      return { ...prev, [employeeId]: shiftId }
    })
  }

  const saveWeek = async () => {
    const rows: { employee_id: string; shift_id: string; date: string }[] = []
    for (const [employeeId, shiftId] of Object.entries(selections)) {
      if (!shiftId) continue
      for (const date of weekDays) {
        rows.push({ employee_id: employeeId, shift_id: shiftId, date })
      }
    }
    if (rows.length === 0) {
      Alert.alert(t('common.error'), t('hrAdmin.noRotatingEmployees'))
      return
    }
    setIsSaving(true)
    const { error } = await supabase
      .from('employee_shifts')
      .upsert(rows, { onConflict: 'employee_id,date' })
    setIsSaving(false)
    if (error) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
    } else {
      Alert.alert(t('common.success'), t('hrAdmin.weekSaved'))
    }
  }

  const ShiftChips = ({
    employeeId,
    availableShifts,
  }: {
    employeeId: string
    availableShifts: Shift[]
  }) => (
    <View className="flex-row flex-wrap gap-1.5 mt-1.5">
      {availableShifts.map(s => {
        const active = selections[employeeId] === s.id
        return (
          <TouchableOpacity
            key={s.id}
            onPress={() => select(employeeId, s.id)}
            className={`px-2.5 py-1 rounded-full border ${active ? 'bg-brand-600 border-brand-600' : 'border-ink-200 bg-white'}`}
          >
            <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-ink-600'}`}>
              {s.name}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  const EmployeeRow = ({ emp, availableShifts }: { emp: Employee; availableShifts: Shift[] }) => (
    <View className="py-3 border-b border-ink-50 last:border-b-0">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <Text className="text-sm font-semibold text-ink-900">{emp.name}</Text>
          <Text className="text-xs text-ink-400 font-mono">{emp.emp_code}</Text>
        </View>
      </View>
      <ShiftChips employeeId={emp.id} availableShifts={availableShifts} />
    </View>
  )

  if (!employee) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-4">
          {t('hrAdmin.shiftPlanning')}
        </Text>

        {/* Week navigator */}
        <View className="flex-row items-center justify-between bg-white rounded-xl border border-ink-100 px-4 py-3 mb-5">
          <TouchableOpacity
            onPress={() => setWeekOffset(w => w - 1)}
            className="w-9 h-9 items-center justify-center rounded-full bg-ink-50"
          >
            <ChevronLeft size={20} color={INK[600]} />
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-xs text-ink-400 uppercase tracking-wide mb-0.5">{t('hrAdmin.weekOf')}</Text>
            <Text className="text-sm font-bold text-ink-900">{fmtWeekLabel(weekStart)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setWeekOffset(w => w + 1)}
            className="w-9 h-9 items-center justify-center rounded-full bg-ink-50"
          >
            <ChevronRight size={20} color={INK[600]} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator color={BRAND[600]} />
          </View>
        ) : (
          <>
            {/* Workers & Supervisors */}
            {workers.length > 0 && rotatingShifts.length > 0 ? (
              <Card className="mb-4">
                <Text className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">
                  {t('hrAdmin.workersAndSupervisors')}
                </Text>
                {workers.map(emp => (
                  <EmployeeRow key={emp.id} emp={emp} availableShifts={rotatingShifts} />
                ))}
              </Card>
            ) : workers.length > 0 ? (
              <Card className="mb-4 py-8 items-center">
                <Calendar size={28} color={INK[300]} />
                <Text className="text-sm text-ink-500 mt-2 text-center">{t('hrAdmin.noRotatingEmployees')}</Text>
              </Card>
            ) : null}

            {/* Security */}
            {security.length > 0 && securityShifts.length > 0 && (
              <Card className="mb-4">
                <Text className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">
                  {t('hrAdmin.securityTeam')}
                </Text>
                {security.map(emp => (
                  <EmployeeRow key={emp.id} emp={emp} availableShifts={securityShifts} />
                ))}
              </Card>
            )}

            {workers.length === 0 && security.length === 0 && (
              <Card className="py-10 items-center">
                <Calendar size={32} color={INK[300]} />
                <Text className="text-sm text-ink-500 mt-3 text-center">{t('hrAdmin.noRotatingEmployees')}</Text>
              </Card>
            )}

            <Button
              title="hrAdmin.saveWeek"
              onPress={saveWeek}
              loading={isSaving}
              className="mt-2"
            />
          </>
        )}
      </ScrollView>
    </View>
  )
}
