import React, { useState, useEffect } from 'react'
import { View, Text, Alert, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useAttendance } from '@/hooks/useAttendance'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import {
  getCurrentLocation,
  getPlantConfig,
  getPlantLocations,
  isInsideAnyGeofence,
  isInsideGeofence,
  buildQrValue,
} from '@/lib/location'
import { BarCodeScanner } from 'expo-barcode-scanner'
import { QrCode, CameraOff, MapPin, Star } from 'lucide-react-native'

export default function QRScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { todayRecord, confirmQr, refresh, isLoading: attendanceLoading } = useAttendance(employee?.id || '')
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync()
      setHasPermission(status === 'granted')
    }
    getBarCodeScannerPermissions()
  }, [])

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isLoading) return
    setScanned(true)
    setIsLoading(true)

    const plant = await getPlantConfig()
    if (!plant) {
      Alert.alert(t('common.error'), 'Plant config not found')
      setIsLoading(false)
      return
    }

    const location = await getCurrentLocation()
    if (!location) {
      Alert.alert(t('common.error'), 'Location required')
      setIsLoading(false)
      return
    }

    const plantLocations = await getPlantLocations()
    const inside =
      plantLocations.length > 0
        ? isInsideAnyGeofence(location.coords.latitude, location.coords.longitude, plantLocations)
        : isInsideGeofence(
            location.coords.latitude,
            location.coords.longitude,
            plant.latitude,
            plant.longitude,
            plant.geofence_radius_meters
          )

    if (!inside) {
      Alert.alert(t('common.warning'), t('worker.outsidePlant'))
      setIsLoading(false)
      return
    }

    const expectedQr = buildQrValue(plant)

    if (data !== expectedQr) {
      Alert.alert(t('common.error'), t('worker.invalidQr'))
      setIsLoading(false)
      return
    }

    const { error } = await confirmQr()
    if (error) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
      setScanned(false)
    } else {
      await refresh()
      Alert.alert(t('common.success'), t('worker.qrConfirmedBody'))
    }
    setIsLoading(false)
  }

  if (!employee) return <LoadingScreen />
  if (hasPermission === null) return <LoadingScreen />
  // Without this, every navigation here shows "GPS first required" for a
  // beat before this screen's own fresh useAttendance fetch resolves —
  // on this site's flaky network that beat can last long enough to look
  // like a real bug (the worker DID check in, but this screen's todayRecord
  // hasn't loaded yet). home.tsx already guards its own render the same way.
  if (attendanceLoading && !todayRecord) return <LoadingScreen />
  if (hasPermission === false) {
    return (
      <View className="flex-1 bg-ink-50">
        <Header empCode={employee.emp_code} role={employee.role} />
        <View className="flex-1 items-center justify-center p-6">
          <CameraOff size={40} color="#D1D5DB" />
          <Text className="text-sm text-ink-500 mt-3 text-center">{t('worker.cameraPermissionRequired')}</Text>
        </View>
      </View>
    )
  }

  // No GPS check-in yet — must check in with GPS first
  if (!todayRecord?.check_in_time) {
    return (
      <View className="flex-1 bg-ink-50">
        <Header empCode={employee.emp_code} role={employee.role} />
        <View className="flex-1 items-center justify-center p-6">
          <View className="w-16 h-16 rounded-full bg-brand-50 items-center justify-center mb-4">
            <MapPin size={32} color="#E65C00" />
          </View>
          <Text className="text-base font-bold text-ink-900 mb-2 text-center">{t('worker.gpsFirstRequired')}</Text>
          <Text className="text-sm text-ink-500 text-center px-4">{t('worker.gpsFirstRequiredHint')}</Text>
        </View>
      </View>
    )
  }

  // QR already confirmed — star already earned
  if (todayRecord?.qr_verified) {
    return (
      <View className="flex-1 bg-ink-50">
        <Header empCode={employee.emp_code} role={employee.role} />
        <View className="flex-1 items-center justify-center p-6">
          <View className="w-16 h-16 rounded-full bg-amber-50 items-center justify-center mb-4">
            <Star size={32} color="#D97706" fill="#D97706" />
          </View>
          <Text className="text-base font-bold text-ink-900 mb-2 text-center">{t('worker.qrStarAlreadyEarned')}</Text>
          <Text className="text-sm text-ink-500 text-center px-4">{t('worker.qrStarEarnedHint')}</Text>
        </View>
      </View>
    )
  }

  // GPS checked in, QR not yet confirmed — show scanner
  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <View className="flex-1 p-4">
        <Text className="text-xs text-ink-500 text-center mb-3 px-2">{t('worker.qrHint')}</Text>
        <Card className="flex-1 items-center justify-center">
          <View className="w-full h-full">
            <BarCodeScanner
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              style={StyleSheet.absoluteFillObject}
            />
            <View className="absolute inset-0 items-center justify-center">
              <View className="w-48 h-48 border-2 border-brand-500 rounded-lg opacity-50" />
            </View>
            <View className="absolute bottom-8 left-0 right-0 items-center">
              <Text className="text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                {scanned ? t('common.loading') : t('worker.scanQr')}
              </Text>
            </View>
          </View>
        </Card>
      </View>
    </View>
  )
}
