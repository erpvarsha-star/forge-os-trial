import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { APP_CONFIG } from '@/lib/config'
import { supabase } from '@/lib/supabase'
import { router } from 'expo-router'
import { registerForPushNotificationsAsync } from '@/lib/notifications'
import { Phone, Lock, Building2 } from 'lucide-react-native'

export default function LoginScreen() {
  const { t } = useTranslation()
  const { isLoading, isAuthenticated, loadEmployee } = useAuth()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/')
    }
  }, [isAuthenticated])

  if (isLoading) return <LoadingScreen />

  const handleSendOtp = async () => {
    setError('')
    if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
      setError(t('auth.invalidPhone'))
      return
    }

    setIsSubmitting(true)
    const { error: sendError } = await supabase.auth.signInWithOtp({
      phone: `+91${phone}`,
    })

    if (sendError) {
      setError(sendError.message)
      setIsSubmitting(false)
      return
    }

    setStep('otp')
    setCountdown(60)
    setIsSubmitting(false)
  }

  const handleVerifyOtp = async () => {
    setError('')
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setError(t('auth.invalidOtp'))
      return
    }

    setIsSubmitting(true)
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`,
      token: otp,
      type: 'sms',
    })

    if (verifyError || !data.session) {
      setError(t('auth.invalidOtp'))
      setIsSubmitting(false)
      return
    }

    const { data: empData, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('phone', `+91${phone}`)
      .single()

    if (empError || !empData) {
      await supabase.auth.signOut()
      setError(t('auth.notRegistered'))
      setIsSubmitting(false)
      return
    }

    await loadEmployee(`+91${phone}`)
    await registerForPushNotificationsAsync(empData.id)
    setIsSubmitting(false)
    router.replace('/')
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center px-6 py-12">
          <View className="w-20 h-20 bg-orange-600 rounded-2xl items-center justify-center mb-6 shadow-lg">
            <Building2 size={40} color="white" />
          </View>

          <Text className="text-2xl font-bold text-gray-900 mb-1">{APP_CONFIG.appName}</Text>
          <Text className="text-sm text-gray-500 mb-8">{APP_CONFIG.companyName}</Text>

          <Text className="text-xl font-bold text-gray-900 mb-6">{t('auth.loginTitle')}</Text>

          {step === 'phone' ? (
            <View className="w-full gap-4">
              <Input
                label={t('auth.enterPhone')}
                placeholder={t('auth.phoneHint')}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                error={error}
                className="w-full"
              />
              <Button
                title="auth.sendOtp"
                onPress={handleSendOtp}
                loading={isSubmitting}
                size="lg"
                className="w-full"
                icon={<Phone size={20} color="white" />}
              />
            </View>
          ) : (
            <View className="w-full gap-4">
              <Text className="text-sm text-gray-600 text-center mb-2">
                {t('auth.otpSent')}: +91 {phone}
              </Text>
              <Input
                label={t('auth.enterOtp')}
                placeholder={t('auth.otpHint')}
                value={otp}
                onChangeText={setOtp}
                keyboardType="numeric"
                maxLength={6}
                error={error}
                className="w-full"
              />
              <Button
                title="auth.verifyOtp"
                onPress={handleVerifyOtp}
                loading={isSubmitting}
                size="lg"
                className="w-full"
                icon={<Lock size={20} color="white" />}
              />
              <Button
                title={countdown > 0 ? `auth.resendIn` : 'auth.resendOtp'}
                onPress={handleSendOtp}
                variant="ghost"
                disabled={countdown > 0}
                className="w-full"
              />
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
