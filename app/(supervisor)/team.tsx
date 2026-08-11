import React, { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { notifyEmployeesByRole } from '@/lib/notifications'
import { Employee, AttendanceRecord } from '@/types'
import { User, Users, CheckCircle2 } from 'lucide-react-native'
import { BRAND, INK } from '@/components/theme'

// Workflow 11 (Fraud Detection): more than 10 confirmations in 90 seconds by
// the same supervisor is treated as bulk/buddy confirmation and flagged.
const FRAUD_CONFIRMATION_THRESHOLD = 10
const FRAUD_WINDOW_MS = 90 * 1000

export default function SupervisorTeam() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [team, setTeam] = useState<(Employee & { attendance?: AttendanceRecord })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // In-memory sliding window of this supervisor's confirmation timestamps —
  // resets on remount, which matches "confirmations in this session".
  const confirmationTimestamps = useRef<number[]>([])
  const fraudFlaggedThisBurst = useRef(false)

  useEffect(() => { fetchTeam() }, [employee])

  const fetchTeam = async () => {
    if (!employee) return
    const today = new Date().toISOString().split('T')[0]
    const { data: members } = await supabase.from('employees').select('*').eq('supervisor_id', employee.id)
    if (!members) { setIsLoading(false); return }
    const ids = members.map(m => m.id)
    const { data: attendance } = await supabase.from('attendance_records').select('*').in('employee_id', ids).eq('date', today)
    const withAttendance = members.map(m => ({ ...m, attendance: attendance?.find(a => a.employee_id === m.id) }))
    setTeam(withAttendance as any)
    setIsLoading(false)
  }

  const checkBulkConfirmationFraud = useCallback(async () => {
    const now = Date.now()
    const recent = confirmationTimestamps.current.filter(ts => now - ts <= FRAUD_WINDOW_MS)
    confirmationTimestamps.current = recent

    if (recent.length <= FRAUD_CONFIRMATION_THRESHOLD) {
      fraudFlaggedThisBurst.current = false
      return
    }
    if (fraudFlaggedThisBurst.current || !employee) return
    fraudFlaggedThisBurst.current = true

    const seconds = Math.round((now - recent[0]) / 1000)
    await supabase.from('fraud_alerts').insert({
      type: 'bulk_confirm',
      employee_id: employee.id,
      description: `${employee.name} confirmed ${recent.length} team members in ${seconds} seconds`,
      severity: 'high',
      status: 'open',
    })

    await notifyEmployeesByRole(
      'plant_head',
      t('supervisor.bulkConfirmTitle'),
      t('supervisor.bulkConfirmBody', { name: employee.name, count: recent.length, seconds })
    )
  }, [employee, t])

  const confirmAttendance = async (member: Employee, status: 'P' | 'A') => {
    if (!employee) return
    setConfirmingId(member.id)
    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('attendance_records').upsert(
      { employee_id: member.id, date: today, status, qr_verified: false, checkpoint3_confirmed_by: employee.id, checkpoint3_at: new Date().toISOString() },
      { onConflict: 'employee_id,date' }
    )

    setConfirmingId(null)
    if (error) { Alert.alert(t('common.error'), t('common.somethingWentWrong')); return }

    setTeam(prev => prev.map(m => (m.id === member.id ? { ...m, attendance: { ...(m.attendance as AttendanceRecord), status } as AttendanceRecord } : m)))
    confirmationTimestamps.current.push(Date.now())
    checkBulkConfirmationFraud()
  }

  const statusDot = (status?: string) => {
    switch (status) { case 'P': return 'bg-status-present'; case 'A': return 'bg-status-absent'; case 'L': return 'bg-status-late'; default: return 'bg-ink-200'; }
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const confirmedCount = team.filter(m => m.attendance?.status === 'P' || m.attendance?.status === 'A').length

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <FlatList
        data={team}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View className="mb-4">
            <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-3">{t('common.team')}</Text>
            {team.length > 0 && (
              <Card className="flex-row items-center gap-3 py-3">
                <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center"><CheckCircle2 size={18} color={BRAND[600]} /></View>
                <Text className="text-sm font-semibold text-ink-900 flex-1">
                  {t('common.confirmedOfTotal', { confirmed: confirmedCount, total: team.length })}
                </Text>
              </Card>
            )}
            <Text className="text-xs text-ink-500 mt-3">{t('supervisor.confirmAttendance')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card className="mb-3">
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center"><User size={20} color={INK[500]} /></View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink-900">{item.name}</Text>
                <Text className="text-xs text-ink-500 font-mono">{item.emp_code} • {item.category}</Text>
              </View>
              <View className={`w-3 h-3 rounded-full ${statusDot(item.attendance?.status)}`} />
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => confirmAttendance(item, 'P')}
                disabled={confirmingId === item.id}
                className={`flex-1 rounded-lg py-3 items-center justify-center min-h-touch ${item.attendance?.status === 'P' ? 'bg-status-present' : 'bg-status-present-bg'}`}
              >
                <Text className={`text-sm font-semibold ${item.attendance?.status === 'P' ? 'text-white' : 'text-status-present'}`}>{t('supervisor.markPresent')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmAttendance(item, 'A')}
                disabled={confirmingId === item.id}
                className={`flex-1 rounded-lg py-3 items-center justify-center min-h-touch ${item.attendance?.status === 'A' ? 'bg-status-absent' : 'bg-status-absent-bg'}`}
              >
                <Text className={`text-sm font-semibold ${item.attendance?.status === 'A' ? 'text-white' : 'text-status-absent'}`}>{t('supervisor.markAbsent')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <Card className="items-center py-10">
            <Users size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('common.noData')}</Text>
          </Card>
        }
      />
    </View>
  )
}
