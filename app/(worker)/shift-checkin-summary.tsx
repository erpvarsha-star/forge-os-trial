import { Redirect } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ShiftCheckinSummary } from '@/components/ShiftCheckinSummary'
import { SHIFT_CHECKIN_SUMMARY_ALLOWED_EMP_CODES } from '@/constants'

// Named-individual access (not a role gate) — see the constant's own comment
// for why. Anyone else landing on this route (typed URL, stale deep link)
// is bounced to home rather than shown the screen or a blank/error state.
export default function WorkerShiftCheckinSummary() {
  const { employee } = useAuth()
  if (!employee) return <LoadingScreen />
  if (!SHIFT_CHECKIN_SUMMARY_ALLOWED_EMP_CODES.includes(employee.emp_code)) {
    return <Redirect href="/(worker)/home" />
  }
  return <ShiftCheckinSummary />
}
