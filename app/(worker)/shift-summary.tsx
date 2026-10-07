import React from 'react'
import { View } from 'react-native'
import { Redirect } from 'expo-router'
import { Header } from '@/components/Header'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ShiftCheckinSummary } from '@/components/ShiftCheckinSummary'
import { useAuth } from '@/hooks/useAuth'
import { SHIFT_CHECKIN_SUMMARY_ALLOWED_EMP_CODES } from '@/constants'

// Named-individual access, not role-based — see the constant's own comment.
// Anyone else landing on this route (typed URL, stale deep link) is bounced
// to home rather than shown the screen.
export default function WorkerShiftSummaryScreen() {
  const { employee } = useAuth()
  if (!employee) return <LoadingScreen />
  if (!SHIFT_CHECKIN_SUMMARY_ALLOWED_EMP_CODES.includes(employee.emp_code)) {
    return <Redirect href="/(worker)/home" />
  }
  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ShiftCheckinSummary />
    </View>
  )
}
