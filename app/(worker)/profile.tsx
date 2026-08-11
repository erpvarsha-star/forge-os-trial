import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { User, Phone, Mail, Building, Tag, Shield } from 'lucide-react-native'

export default function ProfileScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()

  if (!employee) return <LoadingScreen />

  const fields = [
    { icon: <User size={18} color="#E65C00" />, label: 'common.name', value: employee.name },
    { icon: <Shield size={18} color="#E65C00" />, label: 'common.employeeCode', value: employee.emp_code },
    { icon: <Phone size={18} color="#E65C00" />, label: 'common.phone', value: employee.phone },
    { icon: <Building size={18} color="#E65C00" />, label: 'common.department', value: employee.department },
    { icon: <Tag size={18} color="#E65C00" />, label: 'common.category', value: employee.category },
    { icon: <Shield size={18} color="#E65C00" />, label: 'common.role', value: employee.role },
  ]

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <View className="items-center mb-6">
          <View className="w-24 h-24 bg-orange-100 rounded-full items-center justify-center mb-3">
            <User size={40} color="#E65C00" />
          </View>
          <Text className="text-xl font-bold text-gray-900">{employee.name}</Text>
          <Text className="text-sm text-gray-500">{employee.emp_code}</Text>
        </View>

        <Card>
          {fields.map((field, index) => (
            <View
              key={index}
              className={`flex-row items-center gap-3 py-3 ${
                index < fields.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              {field.icon}
              <View className="flex-1">
                <Text className="text-xs text-gray-500">{t(field.label)}</Text>
                <Text className="text-sm font-medium text-gray-900 mt-0.5">{field.value || '—'}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  )
}
