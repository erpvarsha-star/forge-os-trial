import React from 'react'
import { View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useAuth } from '@/hooks/useAuth'
import { useShiftAllocation } from '@/hooks/useShiftAllocation'
import { ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react-native'
import { BRAND, INK } from '@/components/theme'

const fmtWeekLabel = (weekStart: string): string => {
  const base = new Date(weekStart + 'T00:00:00Z')
  const end = new Date(base.getTime() + 5 * 86_400_000)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${fmt(base)} – ${fmt(end)}`
}

// Reuses app/(hr-admin)/shifts.tsx's week-nav + chip-grid pattern, scoped to
// employees.shift_allocator_id instead of the whole company, and writing
// through allocate_team_shift_week() (the actual security boundary) instead
// of a direct upsert. Shared by app/(manager)/shifts.tsx and
// app/(supervisor)/shifts.tsx — the other 7 named allocators from Yash's
// Shift_Planning_1.csv roster besides HR, which keeps its own unscoped screen.
export function ShiftAllocationGrid() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const {
    weekOffset,
    setWeekOffset,
    weekStart,
    shifts,
    team,
    selections,
    select,
    saveWeek,
    isLoading,
    isSaving,
  } = useShiftAllocation(employee?.id)

  if (!employee) return <LoadingScreen />

  const handleSave = async () => {
    const ok = await saveWeek()
    if (ok) {
      Alert.alert(t('common.success'), t('hrAdmin.weekSaved'))
    } else {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
    }
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-4">
          {t('shiftAllocator.tab')}
        </Text>

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
        ) : team.length === 0 ? (
          <Card className="py-10 items-center">
            <Users size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('shiftAllocator.noTeam')}</Text>
          </Card>
        ) : shifts.length === 0 ? (
          <Card className="py-10 items-center">
            <Calendar size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('hrAdmin.noShiftsYet')}</Text>
          </Card>
        ) : (
          <>
            <Card className="mb-4">
              <Text className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">
                {t('shiftAllocator.myTeam')}
              </Text>
              {team.map(emp => (
                <View key={emp.id} className="py-3 border-b border-ink-50 last:border-b-0">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-semibold text-ink-900">{emp.name}</Text>
                      <Text className="text-xs text-ink-400 font-mono">{emp.emp_code}</Text>
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-1.5 mt-1.5">
                    {shifts.map(s => {
                      const active = selections[emp.id] === s.id
                      return (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => select(emp.id, s.id)}
                          className={`px-2.5 py-1 rounded-full border ${active ? 'bg-brand-600 border-brand-600' : 'border-ink-200 bg-white'}`}
                        >
                          <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-ink-600'}`}>
                            {s.name}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              ))}
            </Card>

            <Button
              title="hrAdmin.saveWeek"
              onPress={handleSave}
              loading={isSaving}
              className="mt-2"
            />
          </>
        )}
      </ScrollView>
    </View>
  )
}
