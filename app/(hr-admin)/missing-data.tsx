import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Employee, DeviceRegistration } from '@/types'
import { AlertCircle, CheckCircle2, Smartphone, Trash2, KeyRound } from 'lucide-react-native'
import { STATUS, INK } from '@/components/theme'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'

interface DeviceRow extends DeviceRegistration {
  employee?: { name: string; emp_code: string }
}

export default function MissingDataScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [incomplete, setIncomplete] = useState<Employee[]>([])
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [clearingId, setClearingId] = useState<string | null>(null)
  const [resetCode, setResetCode] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const loadData = useCallback(async () => {
    if (!employee) return
    setIsLoading(true)

    const [{ data: empData }, { data: devData }] = await Promise.all([
      supabase.from('employees').select('*').eq('is_active', true),
      supabase
        .from('device_registrations')
        .select('*, employee:employees(name, emp_code)')
        .order('registered_at', { ascending: false }),
    ])

    if (empData) {
      const filtered = (empData as Employee[]).filter(
        e => !e.department || !e.category || !e.supervisor_id
      )
      setIncomplete(filtered)
    }
    if (devData) setDevices(devData as DeviceRow[])

    setIsLoading(false)
  }, [employee])

  useEffect(() => { loadData() }, [loadData])

  const clearDevice = async (emp: { id: string; name: string; emp_code: string }) => {
    Alert.alert(
      t('hrAdmin.clearDeviceTitle'),
      t('hrAdmin.clearDeviceConfirm', { name: emp.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('hrAdmin.clearDeviceAction'),
          style: 'destructive',
          onPress: async () => {
            setClearingId(emp.id)
            const { error } = await supabase.rpc('clear_device_registration', {
              p_employee_id: emp.id,
            })
            setClearingId(null)
            if (error) {
              Alert.alert(t('common.error'), t('common.somethingWentWrong'))
            } else {
              await loadData()
            }
          },
        },
      ]
    )
  }

  const handleResetPin = async () => {
    const code = resetCode.trim()
    if (!code || isResetting) return
    setIsResetting(true)

    const { data: match } = await supabase
      .from('employees')
      .select('id, name, emp_code')
      .ilike('emp_code', code)
      .eq('is_active', true)
      .maybeSingle()

    if (!match) {
      setIsResetting(false)
      Alert.alert(t('common.error'), t('hrAdmin.employeeNotFound'))
      return
    }

    const { data, error } = await supabase.rpc('reset_employee_pin', { p_employee_id: match.id })
    setIsResetting(false)

    if (error) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
      return
    }

    setResetCode('')
    Alert.alert(
      t('hrAdmin.pinResetTitle'),
      t('hrAdmin.pinResetBody', { name: match.name, pin: data.starting_pin })
    )
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const missingFieldLabels = (emp: Employee) => {
    const fields: string[] = []
    if (!emp.department) fields.push(t('common.department'))
    if (!emp.category) fields.push(t('common.category'))
    if (!emp.supervisor_id) fields.push(t('hrAdmin.supervisorField'))
    return fields
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Missing profile data */}
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('hrAdmin.missingData')}</Text>
          {incomplete.length > 0 && (
            <View className="bg-status-pending-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-pending">{incomplete.length}</Text>
            </View>
          )}
        </View>

        {incomplete.length === 0 ? (
          <Card className="items-center py-10 mb-6">
            <CheckCircle2 size={32} color={STATUS.approved.fg} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('hrAdmin.noMissingData')}</Text>
          </Card>
        ) : (
          <>
            {incomplete.map(emp => (
              <Card key={emp.id} className="mb-3 bg-status-pending-bg" variant="flat">
                <View className="flex-row items-start gap-3">
                  <AlertCircle size={18} color={STATUS.pending.fg} style={{ marginTop: 1 }} />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-ink-900">
                      {emp.name}{' '}
                      <Text className="font-mono text-xs text-ink-500">({emp.emp_code})</Text>
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5 mt-2">
                      {missingFieldLabels(emp).map(f => (
                        <View key={f} className="bg-white rounded-full px-2 py-0.5">
                          <Text className="text-xs font-semibold text-status-pending">{f}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </Card>
            ))}
            <View className="mb-6" />
          </>
        )}

        {/* Reset forgotten PIN */}
        <View className="flex-row items-center gap-2 mb-4">
          <KeyRound size={18} color={INK[500]} />
          <Text className="text-lg font-bold text-ink-900">{t('hrAdmin.resetPin')}</Text>
        </View>
        <Text className="text-xs text-ink-500 mb-4">{t('hrAdmin.resetPinHint')}</Text>
        <Card className="mb-6">
          <View className="flex-row gap-2 items-start">
            <Input
              value={resetCode}
              onChangeText={setResetCode}
              placeholder={t('hrAdmin.resetPinPlaceholder')}
              className="flex-1"
            />
            <Button
              title="hrAdmin.resetPinAction"
              onPress={handleResetPin}
              loading={isResetting}
              disabled={!resetCode.trim()}
              size="md"
            />
          </View>
        </Card>

        {/* Device registrations */}
        <View className="flex-row items-center gap-2 mb-4">
          <Smartphone size={18} color={INK[500]} />
          <Text className="text-lg font-bold text-ink-900">{t('hrAdmin.deviceRegistrations')}</Text>
          {devices.length > 0 && (
            <View className="bg-ink-100 px-2.5 py-0.5 rounded-full ml-1">
              <Text className="text-xs font-bold text-ink-600">{devices.length}</Text>
            </View>
          )}
        </View>
        <Text className="text-xs text-ink-500 mb-4">{t('hrAdmin.deviceRegistrationsHint')}</Text>

        {devices.length === 0 ? (
          <Card className="items-center py-8">
            <Smartphone size={28} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-2 text-center">{t('hrAdmin.noDevices')}</Text>
          </Card>
        ) : (
          devices.map(row => {
            const emp = row.employee as { name: string; emp_code: string; id?: string } | undefined
            return (
              <Card key={row.id} className="mb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="text-sm font-bold text-ink-900">{emp?.name ?? '—'}</Text>
                    <Text className="text-xs font-mono text-ink-400">{emp?.emp_code ?? '—'}</Text>
                    <Text className="text-[10px] text-ink-300 mt-0.5 font-mono" numberOfLines={1}>
                      {row.device_id}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      if (!emp) return
                      clearDevice({ id: row.employee_id, name: emp.name, emp_code: emp.emp_code })
                    }}
                    disabled={clearingId === row.employee_id}
                    className="w-9 h-9 items-center justify-center rounded-full bg-red-50"
                  >
                    {clearingId === row.employee_id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Trash2 size={16} color="#DC2626" />
                    )}
                  </TouchableOpacity>
                </View>
              </Card>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
