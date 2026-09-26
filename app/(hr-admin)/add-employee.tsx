import React, { useState } from 'react'
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { router } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { SalaryBreakupFields, emptyBreakup, breakupIsValid, breakupToPayload, SalaryBreakup } from '@/components/SalaryBreakupFields'

type Category = 'staff' | 'worker' | 'consultant'
type OnboardableRole = 'member' | 'supervisor' | 'manager' | 'security_guard'
type Gender = 'male' | 'female'

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map(opt => {
        const active = opt.key === value
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            className={`px-3.5 py-2 rounded-full border ${
              active ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-200'
            }`}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink-700'}`}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export default function AddEmployeeScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()

  const [empCode, setEmpCode] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [category, setCategory] = useState<Category>('staff')
  const [role, setRole] = useState<OnboardableRole>('member')
  const [gender, setGender] = useState<Gender | ''>('')
  const [breakup, setBreakup] = useState<SalaryBreakup>(emptyBreakup)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!employee) return <LoadingScreen />

  const canSubmit = !!(empCode.trim() && name.trim() && department.trim() && breakupIsValid(breakup))

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)

    const { error } = await supabase.rpc('add_employee', {
      p_emp_code: empCode.trim().toUpperCase(),
      p_name: name.trim(),
      p_phone: phone.trim() || null,
      p_department: department.trim(),
      p_category: category,
      p_role: role,
      p_gender: gender || null,
      p_breakup: breakupToPayload(breakup),
    })

    setIsSubmitting(false)

    if (error) {
      const alreadyExists = error.message?.includes('already exists')
      Alert.alert(
        t('common.error'),
        alreadyExists ? t('hrAdmin.employeeAlreadyExists') : t('common.somethingWentWrong')
      )
      return
    }

    Alert.alert(
      t('hrAdmin.employeeSubmitted'),
      t('hrAdmin.employeeSubmittedBody', { name: name.trim(), code: empCode.trim().toUpperCase() }),
      [{ text: t('common.submit'), onPress: () => router.back() }]
    )
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-1">
          {t('hrAdmin.addEmployee')}
        </Text>
        <Text className="text-sm text-ink-500 mb-5">{t('hrAdmin.addEmployeeHint')}</Text>

        <Card className="gap-4 mb-4">
          <Input
            label={t('hrAdmin.empCodeLabel')}
            value={empCode}
            onChangeText={setEmpCode}
            placeholder={t('hrAdmin.empCodePlaceholder')}
            required
          />
          <Input label={t('common.name')} value={name} onChangeText={setName} required />
          <Input
            label={t('common.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            helperText={t('common.optional')}
          />
          <Input label={t('common.department')} value={department} onChangeText={setDepartment} required />

          <View>
            <Text className="text-sm font-semibold text-ink-700 mb-1.5">{t('common.category')}</Text>
            <ChipRow
              value={category}
              onChange={setCategory}
              options={[
                { key: 'staff', label: t('hrAdmin.categoryStaff') },
                { key: 'worker', label: t('hrAdmin.categoryWorker') },
                { key: 'consultant', label: t('hrAdmin.categoryConsultant') },
              ]}
            />
          </View>

          <View>
            <Text className="text-sm font-semibold text-ink-700 mb-1.5">{t('common.role')}</Text>
            <ChipRow
              value={role}
              onChange={setRole}
              options={[
                { key: 'member', label: t('hrAdmin.roleMember') },
                { key: 'supervisor', label: t('hrAdmin.roleSupervisor') },
                { key: 'manager', label: t('hrAdmin.roleManager') },
                { key: 'security_guard', label: t('hrAdmin.roleSecurityGuard') },
              ]}
            />
          </View>

          <View>
            <Text className="text-sm font-semibold text-ink-700 mb-1.5">
              {t('common.gender')} <Text className="text-ink-400 font-normal">({t('common.optional')})</Text>
            </Text>
            <ChipRow
              value={gender}
              onChange={setGender}
              options={[
                { key: 'male' as Gender | '', label: t('common.male') },
                { key: 'female' as Gender | '', label: t('common.female') },
              ]}
            />
          </View>
        </Card>

        <Text className="text-lg font-bold text-ink-900 mb-1">{t('hrAdmin.salaryBreakup')}</Text>
        <Text className="text-xs text-ink-500 mb-4">{t('hrAdmin.salaryApprovalHint')}</Text>
        <Card className="mb-2">
          <SalaryBreakupFields value={breakup} onChange={setBreakup} />
        </Card>

        <Button
          title="hrAdmin.addEmployeeSubmit"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!canSubmit}
          size="lg"
          className="mt-6"
        />
      </ScrollView>
    </View>
  )
}
