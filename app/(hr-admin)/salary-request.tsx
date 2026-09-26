import React, { useState } from 'react'
import { View, Text, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { SalaryBreakupFields, emptyBreakup, breakupIsValid, breakupToPayload, SalaryBreakup } from '@/components/SalaryBreakupFields'

interface FoundEmployee {
  id: string
  emp_code: string
  name: string
  department: string
}

/** HR-only. Only the owner can ever finalize a salary figure — this screen
 *  submits a request; nothing in employee_salary_structure changes until
 *  the owner approves it from their own Approvals tab. */
export default function SalaryRequestScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()

  const [searchCode, setSearchCode] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [found, setFound] = useState<FoundEmployee | null>(null)
  const [breakup, setBreakup] = useState<SalaryBreakup>(emptyBreakup)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!employee) return <LoadingScreen />

  const handleSearch = async () => {
    const code = searchCode.trim()
    if (!code || isSearching) return
    setIsSearching(true)
    setFound(null)

    const { data } = await supabase
      .from('employees')
      .select('id, emp_code, name, department')
      .ilike('emp_code', code)
      .eq('is_active', true)
      .maybeSingle()

    setIsSearching(false)

    if (!data) {
      Alert.alert(t('common.error'), t('hrAdmin.employeeNotFound'))
      return
    }
    setFound(data as FoundEmployee)
    setBreakup(emptyBreakup)
  }

  const canSubmit = !!found && breakupIsValid(breakup)

  const handleSubmit = async () => {
    if (!canSubmit || !found || isSubmitting) return
    setIsSubmitting(true)

    const { error } = await supabase.rpc('request_salary_change', {
      p_employee_id: found.id,
      p_breakup: breakupToPayload(breakup),
    })

    setIsSubmitting(false)

    if (error) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
      return
    }

    Alert.alert(t('hrAdmin.salaryRequestSubmitted'), t('hrAdmin.salaryRequestSubmittedBody', { name: found.name }))
    setFound(null)
    setSearchCode('')
    setBreakup(emptyBreakup)
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-1">{t('hrAdmin.salaryRequests')}</Text>
        <Text className="text-sm text-ink-500 mb-5">{t('hrAdmin.salaryApprovalHint')}</Text>

        <Card className="mb-4">
          <View className="flex-row gap-2 items-start">
            <Input
              value={searchCode}
              onChangeText={setSearchCode}
              placeholder={t('hrAdmin.empCodePlaceholder')}
              className="flex-1"
            />
            <Button
              title="common.search"
              onPress={handleSearch}
              loading={isSearching}
              disabled={!searchCode.trim()}
              size="md"
            />
          </View>
        </Card>

        {found && (
          <>
            <Card className="mb-4" variant="flat">
              <Text className="text-sm font-bold text-ink-900">{found.name}</Text>
              <Text className="text-xs text-ink-500 font-mono mt-0.5">{found.emp_code} • {found.department}</Text>
            </Card>

            <Text className="text-lg font-bold text-ink-900 mb-1">{t('hrAdmin.salaryBreakup')}</Text>
            <Card className="mb-2">
              <SalaryBreakupFields value={breakup} onChange={setBreakup} />
            </Card>

            <Button
              title="hrAdmin.submitForApproval"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmit}
              size="lg"
              className="mt-6"
            />
          </>
        )}
      </ScrollView>
    </View>
  )
}
