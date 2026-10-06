import React from 'react'
import { View } from 'react-native'
import { Header } from '@/components/Header'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ShiftCheckinSummary } from '@/components/ShiftCheckinSummary'
import { useAuth } from '@/hooks/useAuth'

// Thin per-role wrapper, same pattern as (manager)/shifts.tsx (28 Sep 2026)
// and the Payslips/Late Comers Review screens — all real work lives in the
// shared hook + component.
export default function HrAdminShiftSummaryScreen() {
  const { employee } = useAuth()
  if (!employee) return <LoadingScreen />
  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ShiftCheckinSummary />
    </View>
  )
}
