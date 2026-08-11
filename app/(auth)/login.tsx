import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { BrandLogo } from '@/components/BrandLogo'
import { APP_CONFIG } from '@/lib/config'
import { supabase } from '@/lib/supabase'
import { router } from 'expo-router'
import { registerForPushNotificationsAsync } from '@/lib/notifications'

/**
 * Employee code (or mobile number) + PIN login.
 *
 * Replaces Phone OTP, which requires an SMS provider and — for Indian numbers
 * — TRAI DLT registration. The OTP screen is preserved verbatim at
 * login-otp.tsx.bak (a .bak extension so expo-router does not route it) and
 * can be restored if PIN sharing becomes a problem; see
 * scripts/PATCH_10_pin_auth_11Aug2026.sql for the rollback notes.
 */
export default function LoginScreen() {
  const { t } = useTranslation()
  const { isLoading, isAuthenticated, employee, loadError, signInWithPin } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [pin, setPin] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated || !employee) return
    // Employees still on their derived starting PIN must replace it before
    // reaching any real screen — those PINs are derived from emp_code and are
    // therefore guessable by anyone who has seen an ID card.
    if (employee.must_change_pin) {
      router.replace('/(auth)/change-pin')
    } else {
      router.replace('/')
    }
  }, [isAuthenticated, employee])

  if (isLoading) return <LoadingScreen />

  const handleLogin = async () => {
    setError('')

    if (!identifier.trim()) {
      setError(t('auth.enterIdentifier'))
      return
    }
    if (!/^\d{6}$/.test(pin)) {
      setError(t('auth.invalidPin'))
      return
    }

    setIsSubmitting(true)
    const { error: signInError } = await signInWithPin(identifier, pin)

    if (signInError) {
      setError(
        signInError.message === 'NOT_FOUND'
          ? t('auth.notRegistered')
          : t('auth.wrongPin')
      )
      setIsSubmitting(false)
      return
    }

    // Best-effort only: registerForPushNotificationsAsync swallows its own
    // failures (lib/notifications.ts), because throwing here would strand the
    // user on this screen after an otherwise successful login.
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) await registerForPushNotificationsAsync(session.user.id)

    setIsSubmitting(false)
    // Redirect is handled by the isAuthenticated effect above, which also
    // routes first-time users to the change-PIN screen.
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center px-6 py-12">
          <BrandLogo size="lg" />

          <Text className="text-2xl font-bold text-gray-900 mb-1 mt-6">{APP_CONFIG.appName}</Text>
          <Text className="text-sm text-gray-500 mb-8">{APP_CONFIG.companyName}</Text>

          <Text className="text-xl font-bold text-gray-900 mb-6">{t('auth.loginTitle')}</Text>

          <View className="w-full max-w-sm">
            <Input
              label={t('auth.identifierLabel')}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={t('auth.identifierHint')}
              className="mb-4"
            />

            <Input
              label={t('auth.pinLabel')}
              value={pin}
              onChangeText={(v: string) => setPin(v.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('auth.pinHint')}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              className="mb-4"
            />

            {!!error && <Text className="text-sm text-red-600 mb-3">{error}</Text>}

            {/* Credentials were accepted but the employee record could not be
                loaded — a backend/RLS problem, not something the employee can
                fix by retrying. Show it rather than stalling silently, and
                include the raw reason so it can be reported to whoever can
                actually fix it. */}
            {!error && !!loadError && (
              <View className="mb-3">
                <Text className="text-sm text-red-600">{t('auth.profileLoadFailed')}</Text>
                <Text className="text-xs text-gray-400 mt-1">{loadError}</Text>
              </View>
            )}

            <Button
              title="auth.login"
              onPress={handleLogin}
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting}
            />

            <Text className="text-xs text-gray-400 text-center mt-6">
              {t('auth.pinHelp')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
