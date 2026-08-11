import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Modal, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Shift, Employee } from '@/types'
import { Calendar, Plus, Clock } from 'lucide-react-native'
import { TouchableOpacity } from 'react-native'
import { BRAND, INK } from '@/components/theme'

export default function ShiftsScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchData() }, [employee])

  const fetchData = async () => {
    const [{ data: sData }, { data: eData }] = await Promise.all([
      supabase.from('shifts').select('*'),
      supabase.from('employees').select('id, name, emp_code').eq('is_active', true),
    ])
    if (sData) setShifts(sData as Shift[])
    if (eData) setEmployees(eData as Employee[])
    setIsLoading(false)
  }

  const assignShift = async () => {
    if (!selectedShift || !selectedEmployee || !selectedDate) {
      Alert.alert(t('common.error'), t('common.required'))
      return
    }
    await supabase.from('employee_shifts').insert({
      employee_id: selectedEmployee,
      shift_id: selectedShift,
      date: selectedDate,
    })
    setShowModal(false)
    Alert.alert(t('common.success'), t('hrAdmin.shiftAssigned'))
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row justify-between items-center mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('hrAdmin.shiftPlanning')}</Text>
          <TouchableOpacity
            onPress={() => setShowModal(true)}
            className="w-11 h-11 rounded-full bg-brand-600 items-center justify-center shadow-card"
            accessibilityRole="button"
            accessibilityLabel={t('hrAdmin.assignShift')}
          >
            <Plus size={22} color="white" />
          </TouchableOpacity>
        </View>

        {shifts.length === 0 ? (
          <Card className="items-center py-10">
            <Calendar size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('hrAdmin.noShiftsYet')}</Text>
          </Card>
        ) : (
          shifts.map(shift => (
            <Card key={shift.id} className="mb-3">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center"><Clock size={18} color={BRAND[600]} /></View>
                <View>
                  <Text className="text-sm font-bold text-ink-900">{shift.name}</Text>
                  <Text className="text-xs text-ink-500 font-mono mt-0.5">{shift.start_time} - {shift.end_time}</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-ink-900 mb-4">{t('hrAdmin.assignShift')}</Text>
            <Text className="text-sm font-semibold text-ink-700 mb-2">{t('hrAdmin.employeeLabel')}</Text>
            <ScrollView horizontal className="mb-4" showsHorizontalScrollIndicator={false}>
              {employees.map(emp => (
                <TouchableOpacity key={emp.id} onPress={() => setSelectedEmployee(emp.id)} className={`mr-2 px-3 py-2.5 rounded-lg border min-h-touch justify-center ${selectedEmployee === emp.id ? 'bg-brand-600 border-brand-600' : 'border-ink-200'}`}>
                  <Text className={`text-sm ${selectedEmployee === emp.id ? 'text-white font-semibold' : 'text-ink-700'}`}>{emp.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text className="text-sm font-semibold text-ink-700 mb-2">{t('common.shift')}</Text>
            <ScrollView horizontal className="mb-4" showsHorizontalScrollIndicator={false}>
              {shifts.map(shift => (
                <TouchableOpacity key={shift.id} onPress={() => setSelectedShift(shift.id)} className={`mr-2 px-3 py-2.5 rounded-lg border min-h-touch justify-center ${selectedShift === shift.id ? 'bg-brand-600 border-brand-600' : 'border-ink-200'}`}>
                  <Text className={`text-sm ${selectedShift === shift.id ? 'text-white font-semibold' : 'text-ink-700'}`}>{shift.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Input label={t('common.date')} value={selectedDate} onChangeText={setSelectedDate} placeholder="YYYY-MM-DD" className="mb-4" />
            <Button title="common.save" onPress={assignShift} className="mb-2" />
            <Button title="common.cancel" onPress={() => setShowModal(false)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </View>
  )
}
