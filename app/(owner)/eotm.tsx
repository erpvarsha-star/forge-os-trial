import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { MonthlyScore } from '@/types'
import { Award, Medal, Star, Trophy } from 'lucide-react-native'
import { BRAND, STATUS } from '@/components/theme'
import { istMonthYear } from '@/lib/istDate'

const CATEGORIES = [
  { key: 'attendance', col: 'attendance_score' },
  { key: 'production', col: 'production_score' },
  { key: 'safety', col: 'safety_score' },
  { key: '5s', col: 'five_s_score' },
] as const

/**
 * Winner selection rule (per HR spec): ONE PERSON, ONE AWARD.
 * The same employee must not win multiple categories in the same month.
 *
 * Allocation: for each category compute the winner's margin over the runner-up.
 * Assign categories in descending margin order — the strongest claim keeps its
 * winner; in every other category the award goes to the next-best employee who
 * has not already won something. (Previously each category independently picked
 * its top scorer with LIMIT 1, so one person could sweep all four.)
 */
function allocateWinners(candidates: Record<string, any[]>): Record<string, any> {
  const order = CATEGORIES
    .map(cat => {
      const rows = candidates[cat.key] ?? []
      const top = rows[0]?.[cat.col] ?? 0
      const runnerUp = rows[1]?.[cat.col] ?? 0
      return { key: cat.key, margin: top - runnerUp }
    })
    .sort((a, b) => b.margin - a.margin)

  const taken = new Set<string>()
  const results: Record<string, any> = {}
  for (const { key } of order) {
    const winner = (candidates[key] ?? []).find(r => !taken.has(r.employee_id))
    if (winner) {
      results[key] = winner
      taken.add(winner.employee_id)
    }
  }
  return results
}

export default function EOTMScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [winners, setWinners] = useState<Record<string, MonthlyScore & { employee: any }>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      if (!employee) return
      const { month, year } = istMonthYear()
      // Top 10 per category so there is always an eligible runner-up to promote.
      const candidates: Record<string, any[]> = {}
      for (const cat of CATEGORIES) {
        const { data } = await supabase
          .from('monthly_scores')
          .select('*, employee:employees(name, emp_code, department)')
          .eq('month', month).eq('year', year)
          .order(cat.col, { ascending: false })
          .limit(10)
        candidates[cat.key] = data ?? []
      }
      setWinners(allocateWinners(candidates))
      setIsLoading(false)
    }
    fetch()
  }, [employee])

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const categories = [
    { key: 'attendance', icon: <Star size={22} color="#B45309" />, tint: 'bg-amber-50', label: 'owner.eotmAttendance' },
    { key: 'production', icon: <Trophy size={22} color={BRAND[600]} />, tint: 'bg-brand-50', label: 'owner.eotmProduction' },
    { key: 'safety', icon: <Medal size={22} color="#1D4ED8" />, tint: 'bg-blue-50', label: 'owner.eotmSafety' },
    { key: '5s', icon: <Award size={22} color={STATUS.approved.fg} />, tint: 'bg-status-approved-bg', label: 'owner.eotm5s' },
  ]

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('owner.eotm')}</Text>
        </View>
        {categories.map(cat => (
          <Card key={cat.key} className="mb-3">
            <View className="flex-row items-center gap-3 mb-3">
              <View className={`w-10 h-10 rounded-full items-center justify-center ${cat.tint}`}>{cat.icon}</View>
              <Text className="text-base font-bold text-ink-900 flex-1">{t(cat.label)}</Text>
            </View>
            {winners[cat.key] ? (
              <View className="pl-1">
                <Text className="text-lg font-bold text-brand-600">{winners[cat.key].employee?.name}</Text>
                <Text className="text-xs text-ink-500 font-mono mt-0.5">{winners[cat.key].employee?.emp_code} • {winners[cat.key].employee?.department}</Text>
              </View>
            ) : (
              <Text className="text-sm text-ink-500 pl-1">{t('common.noData')}</Text>
            )}
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
