import React, { useState, useEffect } from 'react'
import { View, Text, Alert, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useAttendance } from '@/hooks/useAttendance'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { getCurrentLocation, getPlantConfig, isInsideGeofence } from '@/lib/location'
import { supabase } from '@/lib/supabase'
import { BarCodeScanner } from 'expo-barcode-scanner'
import { QrCode, ScanLine } from 'lucide-react-native'

export default function QRScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { todayRecord, checkIn, refresh } = useAttendance(employee?.id || '')
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

    if (todayRecord?.check_in_time) {
      Alert.alert(t('common.warning'), t('worker.alreadyCheckedIn'))
      setIsLoading(false)
      return
    }

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

    const inside = isInsideGeofence(
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

    const today = new Date().toISOString().split('T')[0]
    const expectedQr = `${plant.id}-${today}-${plant.qr_secret_salt}`
    // In production, verify SHA256 hash
    // For demo, simple string check
    if (data !== expectedQr && !data.includes(plant.id)) {
      Alert.alert(t('common.error'), t('worker.invalidQr'))
      setIsLoading(false)
      return
    }

    await checkIn(location.coords.latitude, location.coords.longitude)
    await refresh()
    Alert.alert(t('common.success'), t('common.checkedIn'))
    setIsLoading(false)
  }

  if (!employee) return <LoadingScreen />
  if (hasPermission === null) return <LoadingScreen />
  if (hasPermission === false) {
    return (
      <View className="flex-1 bg-gray-50">
        <Header empCode={employee.emp_code} role={employee.role} />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-sm text-gray-500">Camera permission required for QR scanning</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <View className="flex-1 p-4">
        <Card className="flex-1 items-center justify-center">
          {todayRecord?.check_in_time ? (
            <View className="items-center">
              <QrCode size={64} className="text-green-600 mb-4" />
              <Text className="text-lg font-bold text-green-600">{t('worker.alreadyCheckedIn')}</Text>
            </View>
          ) : (
            <View className="w-full h-full">
              <BarCodeScanner
                onBarCodeScanned={handleBarCodeScanned}
                style={StyleSheet.absoluteFillObject}
              />
              <View className="absolute inset-0 items-center justify-center">
                <View className="w-48 h-48 border-2 border-orange-500 rounded-lg opacity-50" />
              </View>
              <View className="absolute bottom-8 left-0 right-0 items-center">
                <Text className="text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                  {t('worker.scanQr')}
                </Text>
              </View>
            </View>
          )}
        </Card>
      </View>
    </View>
  )
}
