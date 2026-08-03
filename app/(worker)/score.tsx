import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useScore } from '@/hooks/useScore'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { ScoreBar } from '@/components/ScoreBar'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Trophy, Medal, Star } from 'lucide-react-native'

export default function WorkerScore() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { score, isLoading } = useScore(employee?.id || '')

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4 gap-4">
        <Card className="items-center py-6">
          <Trophy size={40} className="text-orange-600 mb-3" />
          <Text className="text-4xl font-bold text-gray-900">{score?.composite_score?.toFixed(1) || '--'}</Text>
          <Text className="text-sm text-gray-500 mt-1">{t('worker.compositeScore')} / 100</Text>
        </Card>

        <Card title={t('worker.compositeScore')}>
          <ScoreBar label={t('worker.attendanceScore')} score={score?.attendance_score || 0} />
          <ScoreBar label={t('worker.onTimeScore')} score={score?.on_time_score || 0} />
          <ScoreBar label={t('worker.taskScore')} score={score?.task_completion_score || 0} />
          <ScoreBar label={t('worker.kpiScore')} score={score?.kpi_score || 0} />
          {employee.category === 'operator' && (
            <ScoreBar label={t('worker.productionScore')} score={score?.production_score || 0} />
          )}
        </Card>

        <Card className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Star size={24} className="text-yellow-500" />
            <View>
              <Text className="text-lg font-bold text-gray-900">{score?.brownie_points || 0}</Text>
              <Text className="text-xs text-gray-500">{t('worker.browniePoints')}</Text>
            </View>
          </View>
          {score?.eotm_badge && (
            <View className="flex-row items-center gap-2">
              <Medal size={24} className={score.eotm_badge === 'gold' ? 'text-yellow-500' : 'text-orange-700'} />
              <Text className="text-sm font-bold text-gray-900 capitalize">
                {t(`worker.${score.eotm_badge}`)}
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  )
}
