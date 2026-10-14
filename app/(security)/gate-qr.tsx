import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useTranslation } from 'react-i18next'
import { RefreshCw, ShieldAlert, Clock } from 'lucide-react-native'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { BRAND, INK } from '@/components/theme'
import { getPlantConfig, PlantConfig, buildQrValue, istQrKey } from '@/lib/location'
import { syncServerClock, serverNowMs, serverIstHHMM, clockSkewInfo } from '@/lib/serverClock'

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
  const [minutesRemaining, setMinutesRemaining] = useState(
    () => 30 - (Math.floor((serverNowMs() + 5.5 * 60 * 60 * 1000) / 60000) % 30)
  )
  const [isLoading, setIsLoading] = useState(true)
  // The QR is built from server-corrected time; show it so a guard whose own
  // phone clock is off can see the real time and be warned about it.
  const [clock, setClock] = useState(() => ({ time: serverIstHHMM(), skew: clockSkewInfo() }))
  const refreshClock = () => setClock({ time: serverIstHHMM(), skew: clockSkewInfo() })

  const load = async () => {
    await syncServerClock(true)
    const config = await getPlantConfig()
    setPlant(config)
    const key = istQrKey()
    setQrKey(key)
    setMinutesRemaining(30 - (Math.floor((serverNowMs() + 5.5 * 60 * 60 * 1000) / 60000) % 30))
    refreshClock()
    setIsLoading(false)
  }

  useEffect(() => {
    load()
    // Fires every minute. Updates both the QR key (when the bucket rolls over)
    // and the countdown, so the guard sees a live "Expires in N min" that ticks
    // down each minute without needing to tap anything.
    const interval = setInterval(() => {
      void syncServerClock()
      const next = istQrKey()
      setQrKey(current =>
        current.date === next.date && current.bucket === next.bucket ? current : next
      )
      setMinutesRemaining(30 - (Math.floor((serverNowMs() + 5.5 * 60 * 60 * 1000) / 60000) % 30))
      refreshClock()
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
              {t('security.qrExpiresIn', { minutes: minutesRemaining })}
            </Text>

            {clock.skew && (
              <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4 max-w-[280px]">
                <ShieldAlert size={16} color="#DC2626" />
                <Text className="text-xs text-red-700 flex-1">{t('worker.clockWrong', clock.skew)}</Text>
              </View>
            )}

            <View className="p-4 bg-white rounded-2xl border border-ink-100">
              <QRCode
                value={qrValue ?? ''}
                size={260}
                quietZone={24}
                // Near-black, not brand orange: a QR scanner needs strong
                // luminance contrast, and orange-on-white reads far worse to
                // a camera than it does to an eye.
                color={INK[900]}
                backgroundColor="#FFFFFF"
              />
            </View>

            <View className="flex-row items-center gap-1 mt-4">
              <Clock size={13} color="#6B7280" />
              <Text className="text-xs font-semibold text-ink-600">{t('security.gateTimeNow', { time: clock.time })}</Text>
            </View>

            <Text className="text-xs text-ink-500 mt-3 text-center max-w-[260px]">
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
