import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { MRMReview } from '@/types'
import { CheckCircle, Clock } from 'lucide-react-native'

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
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('plantHead.mrmStatus')}</Text>
        {reviews.map(review => (
          <Card key={review.id} className="mb-2">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold text-gray-900">{review.department}</Text>
                <Text className="text-xs text-gray-500">Safety: {review.safety_score} | Quality: {review.quality_score}</Text>
              </View>
              {review.status === 'submitted' ? <CheckCircle size={20} className="text-green-600" /> : <Clock size={20} className="text-yellow-600" />}
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
