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
import { getPlantConfig, PlantConfig, buildQrValue, istQrKey } from '@/lib/location'

/**
 * The gate QR, on a guard's phone, regenerated every 30 minutes (PATCH_37).
 *
 * Computes the SAME string worker/qr.tsx and CheckInCard.tsx expect:
 *   `${plant.id}-${date}-${bucket}-${plant.qr_secret_salt}`
 * where bucket = IST 30-minute slot index (0–47). A photo of this QR
 * is worthless after the current 30-minute window ends.
 */

export default function GateQrScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [plant, setPlant] = useState<PlantConfig | null>(null)
  const [qrKey, setQrKey] = useState(istQrKey())
  const [isLoading, setIsLoading] = useState(true)

  const load = async () => {
    const config = await getPlantConfig()
    setPlant(config)
    setQrKey(istQrKey())
    setIsLoading(false)
  }

  useEffect(() => {
    load()
    // Checks every minute for date or bucket change — bucket rolls every 30
    // minutes, so a 1-minute tick is fast enough to pick it up promptly.
    const interval = setInterval(() => {
      const next = istQrKey()
      setQrKey(current =>
        current.date === next.date && current.bucket === next.bucket ? current : next
      )
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const qrValue = useMemo(() => {
    if (!plant) return null
    return buildQrValue(plant)
  // buildQrValue reads the clock internally; qrKey is the reactive dependency
  // that forces a re-render when the bucket or date rolls over.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plant, qrKey])

  const bucketMinutesRemaining = 30 - (Math.floor((Date.now() + 5.5 * 60 * 60 * 1000) / 60000) % 30)

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
            <Text className="text-lg font-bold text-ink-900 mb-1">{qrKey.date}</Text>
            <Text className="text-xs text-ink-500 mb-5">
              {t('security.qrExpiresIn', { minutes: bucketMinutesRemaining })}
            </Text>

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
