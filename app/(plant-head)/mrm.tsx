import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { MRMReview } from '@/types'
import { CheckCircle, Clock, FileText } from 'lucide-react-native'
import { STATUS, INK } from '@/components/theme'

export default function PlantHeadMRM() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [reviews, setReviews] = useState<MRMReview[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      if (!employee) return
      const now = new Date()
      const { data } = await supabase.from('mrm_reviews').select('*').eq('month', String(now.getMonth() + 1).padStart(2, '0')).eq('year', now.getFullYear())
      if (data) setReviews(data as MRMReview[])
      setIsLoading(false)
    }
    fetch()
  }, [employee])

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const submittedCount = reviews.filter(r => r.status === 'submitted').length

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('plantHead.mrmStatus')}</Text>
        </View>

        {reviews.length > 0 && (
          <Card className="mb-4 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-ink-700">{t('plantHead.departmentsSubmitted')}</Text>
            <Text className="text-lg font-bold text-brand-600 tabular-nums">{submittedCount} / {reviews.length}</Text>
          </Card>
        )}

        {reviews.length === 0 ? (
          <Card className="items-center py-10">
            <FileText size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('plantHead.noMrmData')}</Text>
          </Card>
        ) : (
          reviews.map(review => (
            <Card key={review.id} className="mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-bold text-ink-900">{review.department}</Text>
                  <Text className="text-xs text-ink-500 mt-0.5">{t('common.safety')}: {review.safety_score} | {t('common.quality')}: {review.quality_score}</Text>
                </View>
                {review.status === 'submitted' ? (
                  <View className="w-8 h-8 rounded-full bg-status-approved-bg items-center justify-center"><CheckCircle size={16} color={STATUS.approved.fg} /></View>
                ) : (
                  <View className="w-8 h-8 rounded-full bg-status-pending-bg items-center justify-center"><Clock size={16} color={STATUS.pending.fg} /></View>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  )
}
