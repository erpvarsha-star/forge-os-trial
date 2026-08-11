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
import { PhotoCapture } from '@/components/PhotoCapture'
import { uploadSubmissionPhoto } from '@/lib/photos'
import { Upload, AlertCircle } from 'lucide-react-native'

export default function ObservationScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [area, setArea] = useState('')
  const [issue, setIssue] = useState('')
  // Base64 is what gets uploaded; the local file URI is only for the preview.
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!employee) return <LoadingScreen />

  const handleSubmit = async () => {
    if (!area || !issue) {
      Alert.alert(t('common.error'), t('common.required'))
      return
    }
    setIsSubmitting(true)

    // Upload first: a failed upload must not silently produce an observation
    // with no photo attached when the user believes they attached one.
    let storedPath: string | null = null
    if (photoBase64) {
      const { path, error: uploadError } = await uploadSubmissionPhoto(employee.id, photoBase64, 'obs')
      if (uploadError) {
        setIsSubmitting(false)
        Alert.alert(t('common.error'), t('worker.photoUploadFailed'))
        return
      }
      storedPath = path
    }

    const { error } = await supabase.from('maintenance_observations').insert({
      employee_id: employee.id,
      area,
      issue_description: issue,
      photo_url: storedPath,
      status: 'open',
    })
    setIsSubmitting(false)
    if (error) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
      return
    }
    Alert.alert(t('common.success'), t('worker.observationSubmitted'))
    setArea('')
    setIssue('')
    setPhotoBase64(null)
    setPhotoPreview(null)
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <View className="flex-row items-start gap-2 mb-4 px-1">
          <AlertCircle size={16} color="#9CA3AF" style={{ marginTop: 1 }} />
          <Text className="text-xs text-ink-500 flex-1">{t('worker.observationHint')}</Text>
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

          <Text className="text-sm font-medium text-ink-700 mb-2">{t('worker.observationPhoto')}</Text>
          <PhotoCapture
            previewUri={photoPreview}
            onCaptured={(base64) => {
              setPhotoBase64(base64)
              setPhotoPreview(`data:image/jpeg;base64,${base64}`)
            }}
          />

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
