import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { FiveSSubmission } from '@/types'
import { CheckCircle, XCircle } from 'lucide-react-native'

export default function FiveSVerifyScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [submissions, setSubmissions] = useState<FiveSSubmission[]>([])
  const [points, setPoints] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchSubmissions() }, [employee])

  const fetchSubmissions = async () => {
    if (!employee) return
    const { data } = await supabase.from('5s_submissions').select('*, employee:employees(name, emp_code)').eq('status', 'pending')
    if (data) setSubmissions(data as FiveSSubmission[])
    setIsLoading(false)
  }

  const verify = async (id: string, approved: boolean) => {
    const pts = parseInt(points[id]) || 0
    await supabase.from('5s_submissions').update({
      status: approved ? 'approved' : 'rejected',
      points_awarded: approved ? pts : 0,
      verified_by: employee!.id,
      verified_at: new Date().toISOString(),
    }).eq('id', id)
    fetchSubmissions()
  }

  if (!employee) return <LoadingScreen />
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('supervisor.5sVerification')}</Text>
        {submissions.map(sub => (
          <Card key={sub.id} className="mb-4">
            <Image source={{ uri: sub.photo_url }} className="w-full h-48 rounded-lg mb-3" resizeMode="cover" />
            <Text className="text-sm text-gray-600 mb-2">{sub.employee?.name} ({sub.employee?.emp_code})</Text>
            <Input label={t('supervisor.pointsToAward')} value={points[sub.id] || ''} onChangeText={v => setPoints(p => ({ ...p, [sub.id]: v }))} keyboardType="numeric" className="mb-3" />
            <View className="flex-row gap-2">
              <Button title="supervisor.verifyPhoto" onPress={() => verify(sub.id, true)} variant="primary" size="sm" className="flex-1" icon={<CheckCircle size={14} color="white" />} />
              <Button title="supervisor.rejectPhoto" onPress={() => verify(sub.id, false)} variant="danger" size="sm" className="flex-1" icon={<XCircle size={14} color="white" />} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
