import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { FactoryOsLink } from '@/components/FactoryOsLink'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { VehicleLogEntry } from '@/types'
import { Truck, ArrowDownToLine, ArrowUpFromLine, ClipboardList } from 'lucide-react-native'

export default function VehicleLogScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [entries, setEntries] = useState<VehicleLogEntry[]>([])
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [driverName, setDriverName] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [material, setMaterial] = useState('')
  const [direction, setDirection] = useState<'inward' | 'outward'>('inward')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchToday = useCallback(async () => {
    setIsLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('vehicle_log')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
    if (data) setEntries(data as VehicleLogEntry[])
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchToday() }, [fetchToday])

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const resetForm = () => {
    setVehicleNumber(''); setDriverName(''); setVendorName(''); setMaterial(''); setDirection('inward')
  }

  const logVehicle = async () => {
    if (!vehicleNumber.trim()) { Alert.alert(t('common.error'), t('security.vehicleNumberRequired')); return }
    setIsSubmitting(true)
    const { error } = await supabase.from('vehicle_log').insert({
      vehicle_number: vehicleNumber.trim().toUpperCase(),
      driver_name: driverName || null,
      vendor_name: vendorName || null,
      material: material || null,
      direction,
      logged_by: employee.id,
      time_in: direction === 'inward' ? new Date().toISOString() : null,
      time_out: direction === 'outward' ? new Date().toISOString() : null,
    })
    setIsSubmitting(false)
    if (!error) { resetForm(); fetchToday() }
    else Alert.alert(t('common.error'), t('common.somethingWentWrong'))
  }

  const inwardCount = entries.filter(e => e.direction === 'inward').length
  const outwardCount = entries.filter(e => e.direction === 'outward').length

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <FactoryOsLink />
        <Text className="text-sm font-bold text-ink-700 mb-2 px-1">{t('common.today')}</Text>
        <Card className="mb-5">
          <View className="flex-row">
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-green-600">{inwardCount}</Text>
              <Text className="text-xs text-ink-500 mt-0.5">{t('security.inward')}</Text>
            </View>
            <View className="w-px bg-ink-100" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-blue-600">{outwardCount}</Text>
              <Text className="text-xs text-ink-500 mt-0.5">{t('security.outward')}</Text>
            </View>
          </View>
        </Card>

        <Card title={t('security.logVehicle')} className="mb-5">
          <Text className="text-xs text-ink-500 mb-3 -mt-1">{t('security.logVehicleHint')}</Text>
          <View className="gap-3">
            <Input label={t('security.vehicleNumber')} value={vehicleNumber} onChangeText={setVehicleNumber} />
            <Input label={t('security.driverName')} value={driverName} onChangeText={setDriverName} />
            <Input label={t('security.vendorName')} value={vendorName} onChangeText={setVendorName} />
            <Input label={t('security.material')} value={material} onChangeText={setMaterial} />

            <Text className="text-sm font-medium text-ink-700">{t('security.direction')}</Text>
            <View className="flex-row gap-2">
              <Button
                title="security.inward"
                onPress={() => setDirection('inward')}
                variant={direction === 'inward' ? 'primary' : 'outline'}
                size="sm"
                className="flex-1"
              />
              <Button
                title="security.outward"
                onPress={() => setDirection('outward')}
                variant={direction === 'outward' ? 'primary' : 'outline'}
                size="sm"
                className="flex-1"
              />
            </View>

            <Button title="common.add" onPress={logVehicle} loading={isSubmitting} icon={<Truck size={18} color="white" />} />
          </View>
        </Card>

        <Text className="text-sm font-bold text-ink-700 mb-2 px-1">{t('security.todaysEntries')}</Text>
        {entries.length === 0 ? (
          <Card className="items-center py-10">
            <ClipboardList size={32} color="#D1D5DB" />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('security.noVehicleEntriesToday')}</Text>
          </Card>
        ) : (
          entries.map(entry => (
            <Card key={entry.id} className="mb-2">
              <View className="flex-row items-center gap-3">
                {entry.direction === 'inward' ? (
                  <ArrowDownToLine size={18} color="#16A34A" />
                ) : (
                  <ArrowUpFromLine size={18} color="#2563EB" />
                )}
                <View className="flex-1">
                  <Text className="text-sm font-bold text-ink-900">{entry.vehicle_number}</Text>
                  <Text className="text-xs text-ink-500">{entry.vendor_name || entry.driver_name || '-'} {entry.material ? `• ${entry.material}` : ''}</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  )
}
