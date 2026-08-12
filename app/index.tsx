import { useEffect } from 'react'
import { Redirect } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { useViewAsStore } from '@/hooks/useViewAs'
import { useEffectiveIdentity } from '@/hooks/useEffectiveIdentity'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ROLE_ROUTES } from '@/constants'

export default function Index() {
  const { isLoading, isAuthenticated, employee } = useAuth()
  const { isHydrated, hydrate } = useViewAsStore()
  const { role } = useEffectiveIdentity()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  // Starting PINs are derived from emp_code (PATCH_10) and so are guessable.
  // This is the only auth guard in the app — every role route funnels through
  // here — so gating here keeps anyone on a default PIN out of real data.
  if (employee?.must_change_pin) return <Redirect href="/(auth)/change-pin" />

  // Wait for the saved "view as" choice before routing, or an admin who left
  // the app in supervisor view gets bounced to their own dashboard for a frame
  // and then moved again, which reads as a glitch.
  if (!isHydrated) return <LoadingScreen />

  // Effective role, not employee.role — see hooks/useViewAs.ts. The override
  // only ever changes which screens render; the database still answers to the
  // admin's real identity, so this cannot be used to see more than they may.
  const route = ROLE_ROUTES[role || 'member']
  return <Redirect href={route as any} />
}
