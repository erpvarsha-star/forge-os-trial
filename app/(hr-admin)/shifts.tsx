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
    Alert.alert(t('common.success'), 'Shift assigned')
  }

  if (!employee) return <LoadingScreen />
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold text-gray-900">{t('hrAdmin.shiftPlanning')}</Text>
          <Button title="" onPress={() => setShowModal(true)} icon={<Plus size={20} color="white" />} />
        </View>
        {shifts.map(shift => (
          <Card key={shift.id} className="mb-2">
            <View className="flex-row items-center gap-3">
              <Clock size={18} className="text-orange-600" />
              <View>
                <Text className="text-sm font-bold text-gray-900">{shift.name}</Text>
                <Text className="text-xs text-gray-500">{shift.start_time} - {shift.end_time}</Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-gray-900 mb-4">{t('hrAdmin.assignShift')}</Text>
            <Text className="text-sm font-medium text-gray-700 mb-2">Employee</Text>
            <ScrollView horizontal className="mb-4" showsHorizontalScrollIndicator={false}>
              {employees.map(emp => (
                <TouchableOpacity key={emp.id} onPress={() => setSelectedEmployee(emp.id)} className={`mr-2 px-3 py-2 rounded-lg border ${selectedEmployee === emp.id ? 'bg-orange-600 border-orange-600' : 'border-gray-300'}`}>
                  <Text className={`text-sm ${selectedEmployee === emp.id ? 'text-white' : 'text-gray-700'}`}>{emp.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text className="text-sm font-medium text-gray-700 mb-2">Shift</Text>
            <ScrollView horizontal className="mb-4" showsHorizontalScrollIndicator={false}>
              {shifts.map(shift => (
                <TouchableOpacity key={shift.id} onPress={() => setSelectedShift(shift.id)} className={`mr-2 px-3 py-2 rounded-lg border ${selectedShift === shift.id ? 'bg-orange-600 border-orange-600' : 'border-gray-300'}`}>
                  <Text className={`text-sm ${selectedShift === shift.id ? 'text-white' : 'text-gray-700'}`}>{shift.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Input label={t('common.date')} value={selectedDate} onChangeText={setSelectedDate} placeholder="YYYY-MM-DD" />
            <Button title="common.save" onPress={assignShift} className="mt-4" />
            <Button title="common.cancel" onPress={() => setShowModal(false)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </View>
  )
}
