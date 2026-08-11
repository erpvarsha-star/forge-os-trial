import { Redirect } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ROLE_ROUTES } from '@/constants'

export default function Index() {
  const { isLoading, isAuthenticated, employee } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  // Starting PINs are derived from emp_code (PATCH_10) and so are guessable.
  // This is the only auth guard in the app — every role route funnels through
  // here — so gating here keeps anyone on a default PIN out of real data.
  if (employee?.must_change_pin) return <Redirect href="/(auth)/change-pin" />

  const route = ROLE_ROUTES[employee?.role || 'member']
  return <Redirect href={route as any} />
}
