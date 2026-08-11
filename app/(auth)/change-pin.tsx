import React, { useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { BrandLogo } from '@/components/BrandLogo'
import { router } from 'expo-router'

/** PINs that are trivially guessable regardless of who owns them. */
const WEAK_PINS = [
  '000000', '111111', '222222', '333333', '444444', '555555',
  '666666', '777777', '888888', '999999', '123456', '654321',
]

/**
 * Forced PIN change on first login.
 *
 * Starting PINs are derived from emp_code (PATCH_10), so they are guessable by
 * anyone who has seen an employee's ID card. must_change_pin gates every real
 * screen behind this one until the employee picks their own.
 */
export default function ChangePinScreen() {
  const { t } = useTranslation()
  const { employee, isLoading, changePin, logout } = useAuth()
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isLoading) return <LoadingScreen />

  const derivedStartingPin = employee?.emp_code
    ? employee.emp_code.replace(/\D/g, '').padStart(6, '0')
    : null

  const handleSubmit = async () => {
    setError('')

    if (!/^\d{6}$/.test(pin)) {
      setError(t('auth.invalidPin'))
      return
    }
    if (pin !== confirmPin) {
      setError(t('auth.pinMismatch'))
      return
    }
    if (WEAK_PINS.includes(pin)) {
      setError(t('auth.pinTooWeak'))
      return
    }
    // Rejecting the starting PIN is the entire point of this screen.
    if (derivedStartingPin && pin === derivedStartingPin) {
      setError(t('auth.pinSameAsStarting'))
      return
    }

    setIsSubmitting(true)
    const { error: changeError } = await changePin(pin)
    if (changeError) {
      setError(t('auth.pinChangeFailed'))
      setIsSubmitting(false)
      return
    }

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
          <BrandLogo size="md" />

          <Text className="text-xl font-bold text-gray-900 mb-2 mt-6">{t('auth.setYourPin')}</Text>
          <Text className="text-sm text-gray-500 mb-8 text-center">{t('auth.setYourPinHelp')}</Text>

          <View className="w-full max-w-sm">
            <Input
              label={t('auth.newPin')}
              value={pin}
              onChangeText={(v: string) => setPin(v.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('auth.pinHint')}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              className="mb-4"
            />

            <Input
              label={t('auth.confirmPin')}
              value={confirmPin}
              onChangeText={(v: string) => setConfirmPin(v.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('auth.pinHint')}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              className="mb-4"
            />

            {!!error && <Text className="text-sm text-red-600 mb-3">{error}</Text>}

            <Button
              title="auth.savePin"
              onPress={handleSubmit}
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting}
            />

            <Button
              title="common.logout"
              onPress={logout}
              variant="ghost"
              className="mt-2"
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
