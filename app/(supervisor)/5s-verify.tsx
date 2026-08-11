import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { FiveSSubmission } from '@/types'
import { CheckCircle, XCircle, ImageOff } from 'lucide-react-native'
import { INK } from '@/components/theme'

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
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('supervisor.5sVerification')}</Text>
          {submissions.length > 0 && (
            <View className="bg-status-pending-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-pending">{t('common.pendingCount', { count: submissions.length })}</Text>
            </View>
          )}
        </View>

        {submissions.length === 0 ? (
          <Card className="items-center py-10">
            <ImageOff size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('supervisor.no5sSubmissions')}</Text>
          </Card>
        ) : (
          submissions.map(sub => (
            <Card key={sub.id} className="mb-4">
              <Image source={{ uri: sub.photo_url }} className="w-full h-48 rounded-lg mb-3" resizeMode="cover" />
              <Text className="text-sm font-semibold text-ink-900 mb-3">{sub.employee?.name} <Text className="font-mono text-ink-500 text-xs">({sub.employee?.emp_code})</Text></Text>
              <Input label={t('supervisor.pointsToAward')} value={points[sub.id] || ''} onChangeText={v => setPoints(p => ({ ...p, [sub.id]: v }))} keyboardType="numeric" className="mb-3" />
              <View className="flex-row gap-2">
                <Button title="supervisor.verifyPhoto" onPress={() => verify(sub.id, true)} variant="primary" size="sm" className="flex-1" icon={<CheckCircle size={14} color="white" />} />
                <Button title="supervisor.rejectPhoto" onPress={() => verify(sub.id, false)} variant="danger" size="sm" className="flex-1" icon={<XCircle size={14} color="white" />} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  )
}
