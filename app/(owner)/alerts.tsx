import React, { useState, useCallback, useEffect } from 'react'
import { View, Text, ScrollView, Modal } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { FraudAlert } from '@/types'
import { AlertTriangle, MapPin, Users, Zap, ShieldCheck, CheckCircle2, XCircle, Search } from 'lucide-react-native'
import { STATUS } from '@/components/theme'

type Resolution = 'confirmed' | 'false_positive' | 'needs_investigation'

export default function OwnerAlerts() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [alerts, setAlerts] = useState<FraudAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [pending, setPending] = useState<{ id: string; resolution: Resolution } | null>(null)
  const [note, setNote] = useState('')

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase.from('fraud_alerts').select('*').eq('status', 'open').order('occurrence_count', { ascending: false })
    if (data) setAlerts(data as FraudAlert[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (employee) fetchAlerts()
  }, [employee, fetchAlerts])

  const confirmResolution = async () => {
    if (!pending) return
    setActingId(pending.id)
    const { error } = await supabase.rpc('resolve_fraud_alert', { p_id: pending.id, p_resolution: pending.resolution, p_note: note || null })
    setActingId(null)
    setPending(null)
    setNote('')
    if (!error) await fetchAlerts()
  }

  const getIcon = (type: string) => {
    const color = STATUS.rejected.fg
    switch (type) {
      case 'mock_location': return <MapPin size={18} color={color} />
      case 'buddy_punching': return <Users size={18} color={color} />
      case 'bulk_confirm': return <Zap size={18} color={color} />
      default: return <AlertTriangle size={18} color={color} />
    }
  }

  const severityBadge = (severity: string) => {
    switch (severity) {
      case 'high': return { bg: 'bg-status-rejected-bg', text: 'text-status-rejected' }
      case 'medium': return { bg: 'bg-status-pending-bg', text: 'text-status-pending' }
      default: return { bg: 'bg-ink-100', text: 'text-ink-600' }
    }
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('owner.fraudAlerts')}</Text>
          {alerts.length > 0 && (
            <View className="bg-status-rejected-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-rejected">{t('owner.openAlerts')}: {alerts.length}</Text>
            </View>
          )}
        </View>

        {alerts.length === 0 ? (
          <Card className="items-center py-10">
            <ShieldCheck size={32} color={STATUS.approved.fg} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('owner.noOpenAlerts')}</Text>
          </Card>
        ) : (
          alerts.map(alert => {
            const badge = severityBadge(alert.severity)
            return (
              <Card key={alert.id} className="mb-3 bg-status-rejected-bg" variant="flat">
                <View className="flex-row items-start gap-3">
                  <View className="w-9 h-9 rounded-full bg-white items-center justify-center mt-0.5">{getIcon(alert.type)}</View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-bold text-status-rejected flex-1 pr-2">{t(`owner.${alert.type}`)}</Text>
                      <View className="flex-row items-center gap-1.5">
                        {alert.occurrence_count > 1 && (
                          <View className="px-2 py-0.5 rounded-full bg-white">
                            <Text className="text-xs font-bold text-status-rejected">{t('owner.alertOccurrences', { count: alert.occurrence_count })}</Text>
                          </View>
                        )}
                        <View className={`px-2 py-0.5 rounded-full ${badge.bg}`}>
                          <Text className={`text-xs font-bold capitalize ${badge.text}`}>{alert.severity}</Text>
                        </View>
                      </View>
                    </View>
                    <Text className="text-xs text-ink-700 mt-1">{alert.description}</Text>
                    <View className="flex-row gap-2 mt-3">
                      <Button
                        title="owner.alertConfirmed"
                        onPress={() => setPending({ id: alert.id, resolution: 'confirmed' })}
                        loading={actingId === alert.id}
                        variant="danger"
                        size="sm"
                        className="flex-1"
                        icon={<CheckCircle2 size={14} color="white" />}
                      />
                      <Button
                        title="owner.alertFalsePositive"
                        onPress={() => setPending({ id: alert.id, resolution: 'false_positive' })}
                        loading={actingId === alert.id}
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        icon={<XCircle size={14} color="#374151" />}
                      />
                      <Button
                        title="owner.alertNeedsInvestigation"
                        onPress={() => setPending({ id: alert.id, resolution: 'needs_investigation' })}
                        loading={actingId === alert.id}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        icon={<Search size={14} color="#1D4ED8" />}
                      />
                    </View>
                  </View>
                </View>
              </Card>
            )
          })
        )}
      </ScrollView>

      <Modal visible={!!pending} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-ink-900 mb-3">
              {pending?.resolution === 'confirmed' ? t('owner.alertConfirmed')
                : pending?.resolution === 'false_positive' ? t('owner.alertFalsePositive')
                : t('owner.alertNeedsInvestigation')}
            </Text>
            <Input value={note} onChangeText={setNote} placeholder={t('owner.alertNotePlaceholder')} multiline numberOfLines={3} className="mb-4" />
            <Button title="common.confirm" onPress={confirmResolution} variant="primary" className="mb-2" />
            <Button title="common.cancel" onPress={() => { setPending(null); setNote('') }} variant="ghost" />
          </View>
        </View>
      </Modal>
    </View>
  )
}
