import React, { useState } from 'react'
import { View, Text, ScrollView, Alert, Image } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Camera } from 'expo-camera'
import { Camera as CameraIcon, Upload, AlertCircle } from 'lucide-react-native'
import { TouchableOpacity } from 'react-native'

export default function ObservationScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [area, setArea] = useState('')
  const [issue, setIssue] = useState('')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!employee) return <LoadingScreen />

  const takePhoto = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('common.error'), 'Camera permission required')
      return
    }
    // In real implementation, use Camera component
    // For now, simulate
    setPhotoUri('https://placeholder.com/photo.jpg')
  }

  const handleSubmit = async () => {
    if (!area || !issue) {
      Alert.alert(t('common.error'), t('common.required'))
      return
    }
    setIsSubmitting(true)
    const { error } = await supabase.from('maintenance_observations').insert({
      employee_id: employee.id,
      area,
      issue_description: issue,
      photo_url: photoUri,
      status: 'open',
    })
    setIsSubmitting(false)
    if (!error) {
      Alert.alert(t('common.success'), 'Observation submitted')
      setArea('')
      setIssue('')
      setPhotoUri(null)
    }
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <View className="flex-row items-start gap-2 mb-4 px-1">
          <AlertCircle size={16} color="#9CA3AF" style={{ marginTop: 1 }} />
          <Text className="text-xs text-gray-500 flex-1">{t('worker.observationHint')}</Text>
        </View>

        <Card>
          <Input
            label={t('worker.observationArea')}
            value={area}
            onChangeText={setArea}
            placeholder={t('worker.observationAreaPlaceholder')}
          />
          <Input
            label={t('worker.observationIssue')}
            value={issue}
            onChangeText={setIssue}
            multiline
            numberOfLines={4}
            placeholder={t('worker.observationIssuePlaceholder')}
            className="mb-4"
          />

          <Text className="text-sm font-medium text-gray-700 mb-2">{t('worker.observationPhoto')}</Text>
          <TouchableOpacity
            onPress={takePhoto}
            className="border-2 border-dashed border-gray-300 rounded-lg h-40 items-center justify-center mb-4"
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} className="w-full h-full rounded-lg" />
            ) : (
              <View className="items-center">
                <CameraIcon size={32} color="#9CA3AF" />
                <Text className="text-sm text-gray-500 mt-2">{t('worker.takePhoto')}</Text>
              </View>
            )}
          </TouchableOpacity>

          <Button
            title="common.submit"
            onPress={handleSubmit}
            loading={isSubmitting}
            icon={<Upload size={18} color="white" />}
          />
        </Card>
      </ScrollView>
    </View>
  )
}
