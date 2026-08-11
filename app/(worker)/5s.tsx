import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image, Alert, Modal } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { FiveSChallenge, FiveSSubmission } from '@/types'
import { PhotoCapture } from '@/components/PhotoCapture'
import { uploadSubmissionPhoto } from '@/lib/photos'
import { Upload, Trophy, CheckCircle, Clock } from 'lucide-react-native'
import { TouchableOpacity } from 'react-native'

export default function FiveSScreen() {
  const { t, i18n } = useTranslation()
  const { employee } = useAuth()
  const [challenge, setChallenge] = useState<FiveSChallenge | null>(null)
  const [submission, setSubmission] = useState<FiveSSubmission | null>(null)
  // Base64 is uploaded; the data URI is only for the on-screen preview.
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const isHindi = i18n.language === 'hi'

  useEffect(() => {
    fetchChallenge()
  }, [employee])

  const fetchChallenge = async () => {
    if (!employee) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('5s_challenges')
      .select('*')
      .eq('date', today)
      .maybeSingle()

    if (data) {
      setChallenge(data as FiveSChallenge)
      const { data: subData } = await supabase
        .from('5s_submissions')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('challenge_id', data.id)
        .maybeSingle()
      if (subData) setSubmission(subData as FiveSSubmission)
    }
    setIsLoading(false)
  }

  const handleSubmit = async () => {
    if (!challenge || !photoBase64) return
    setIsSubmitting(true)

    // Upload before inserting: a 5S submission with no usable photo cannot be
    // verified by a supervisor, so a failed upload must block the insert
    // rather than create an unverifiable row.
    const { path, error: uploadError } = await uploadSubmissionPhoto(employee!.id, photoBase64, '5s')
    if (uploadError || !path) {
      setIsSubmitting(false)
      Alert.alert(t('common.error'), t('worker.photoUploadFailed'))
      return
    }

    const { error } = await supabase.from('5s_submissions').insert({
      employee_id: employee!.id,
      challenge_id: challenge.id,
      photo_url: path,
      status: 'pending',
      points_awarded: 0,
    })
    setIsSubmitting(false)
    if (error) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
      return
    }
    Alert.alert(t('common.success'), t('worker.photoSubmitted'))
    setPhotoBase64(null)
    setPhotoPreview(null)
    fetchChallenge()
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        {challenge ? (
          <>
            <Card className="mb-4 bg-brand-50 border-brand-200">
              <View className="flex-row items-center gap-2 mb-2">
                <Trophy size={20} className="text-brand-600" />
                <Text className="text-lg font-bold text-brand-800">{t('worker.5sChallenge')}</Text>
              </View>
              <Text className="text-base text-ink-900 leading-relaxed">
                {isHindi ? challenge.challenge_text_hi : challenge.challenge_text_en}
              </Text>
              {isHindi && (
                <Text className="text-sm text-ink-600 mt-2 italic">{challenge.challenge_text_en}</Text>
              )}
            </Card>

            {submission ? (
              <Card>
                <View className="flex-row items-center gap-2 mb-3">
                  {submission.status === 'approved' ? (
                    <CheckCircle size={20} className="text-green-600" />
                  ) : (
                    <Clock size={20} className="text-yellow-600" />
                  )}
                  <Text className={`text-sm font-bold ${
                    submission.status === 'approved' ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {submission.status === 'approved' ? t('worker.5sVerified') : t('worker.5sPending')}
                  </Text>
                </View>
                {submission.status === 'approved' && (
                  <Text className="text-2xl font-bold text-brand-600">+{submission.points_awarded} pts</Text>
                )}
              </Card>
            ) : (
              <Card>
                <Text className="text-sm font-medium text-ink-700 mb-2">{t('worker.5sSubmit')}</Text>
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
                  disabled={!photoBase64}
                  icon={<Upload size={18} color="white" />}
                />
              </Card>
            )}
          </>
        ) : (
          <Card className="items-center py-14">
            <Trophy size={40} color="#D1D5DB" />
            <Text className="text-sm text-ink-500 mt-3 text-center px-4">{t('worker.5sNoChallenge')}</Text>
          </Card>
        )}
      </ScrollView>
    </View>
  )
}
