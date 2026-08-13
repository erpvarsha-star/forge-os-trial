import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useTranslation } from 'react-i18next'
import { RefreshCw, ShieldAlert } from 'lucide-react-native'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { BRAND, INK } from '@/components/theme'
import { getPlantConfig, PlantConfig } from '@/lib/location'

/**
 * The gate QR, on a guard's phone, regenerated daily.
 *
 * Answers the "a+c" decision on QR check-in (13 Aug): build the real display
 * (a) so QR check-in stops being decorative, while leaving the loose
 * containment check in app/(worker)/qr.tsx alone for now (c) — see the note
 * there — until this screen is confirmed in daily use at the gate. Don't
 * remove a fallback the moment its replacement ships; remove it once the
 * replacement is actually relied on.
 *
 * Computes the SAME string worker/qr.tsx expects:
 *   `${plant.id}-${date}-${plant.qr_secret_salt}`
 * — plant.id is plant_config.plant_code, date is the IST calendar date, and
 * the salt is the one PATCH_16 generates inside Postgres (never seen by
 * anyone, including this screen — it's read straight from plant_config).
 * Because it's IST-anchored, this rolls over correctly even though the guard's
 * phone clock is whatever timezone it happens to be in.
 */

function istDateKey(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default function GateQrScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [plant, setPlant] = useState<PlantConfig | null>(null)
  const [dateKey, setDateKey] = useState(istDateKey())
  const [isLoading, setIsLoading] = useState(true)

  const load = async () => {
    const config = await getPlantConfig()
    setPlant(config)
    setDateKey(istDateKey())
    setIsLoading(false)
  }

  useEffect(() => {
    load()
    // Checks every minute for the IST date rolling over, so the screen does
    // not need to be reopened at midnight for the new day's code to appear.
    const interval = setInterval(() => {
      const today = istDateKey()
      setDateKey(current => (current === today ? current : today))
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const qrValue = useMemo(() => {
    if (!plant) return null
    return `${plant.id}-${dateKey}-${plant.qr_secret_salt}`
  }, [plant, dateKey])

  if (!employee || isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />

      <View className="flex-1 items-center justify-center p-6">
        {!plant || !plant.qr_secret_salt ? (
          <Card className="items-center py-8">
            <ShieldAlert size={32} color="#DC2626" />
            <Text className="text-sm font-bold text-ink-900 mt-3 text-center">
              {t('security.qrNotConfigured')}
            </Text>
            <Text className="text-xs text-ink-500 mt-1 text-center">
              {t('security.qrNotConfiguredHint')}
            </Text>
          </Card>
        ) : (
          <Card className="items-center py-8 px-8">
            <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
              {t('security.todaysGateCode')}
            </Text>
            <Text className="text-lg font-bold text-ink-900 mb-5">{dateKey}</Text>

            <View className="p-4 bg-white rounded-2xl border border-ink-100">
              <QRCode
                value={qrValue ?? ''}
                size={220}
                // Near-black, not brand orange: a QR scanner needs strong
                // luminance contrast, and orange-on-white reads far worse to
                // a camera than it does to an eye.
                color={INK[900]}
                backgroundColor="#FFFFFF"
              />
            </View>

            <Text className="text-xs text-ink-500 mt-5 text-center max-w-[260px]">
              {t('security.qrHint')}
            </Text>

            <TouchableOpacity onPress={load} className="flex-row items-center gap-2 mt-5 px-4 py-2 rounded-full bg-ink-100 min-h-touch">
              <RefreshCw size={14} color={BRAND[600]} />
              <Text className="text-xs font-bold text-ink-700">{t('common.refresh')}</Text>
            </TouchableOpacity>
          </Card>
        )}
      </View>
    </View>
  )
}
