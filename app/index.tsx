import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '@/hooks/useAuth'
import { useViewAsStore } from '@/hooks/useViewAs'
import { useEffectiveIdentity } from '@/hooks/useEffectiveIdentity'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ROLE_ROUTES } from '@/constants'
import { PERMISSIONS_DONE_KEY } from '@/lib/permissions'

export default function Index() {
  const { isLoading, isAuthenticated, employee } = useAuth()
  const { isHydrated, hydrate } = useViewAsStore()
  const { role } = useEffectiveIdentity()
  // null = not yet read, true = done, false = not done
  const [permissionsDone, setPermissionsDone] = useState<boolean | null>(null)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    AsyncStorage.getItem(PERMISSIONS_DONE_KEY)
      .then(v => setPermissionsDone(v === '1'))
      .catch(() => setPermissionsDone(true)) // fail open — never block the app
  }, [])

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  // Starting PINs are derived from emp_code (PATCH_10) and so are guessable.
  // This is the only auth guard in the app — every role route funnels through
  // here — so gating here keeps anyone on a default PIN out of real data.
  if (employee?.must_change_pin) return <Redirect href="/(auth)/change-pin" />

  // First-time users who already changed their PIN on a previous install but
  // never saw the permissions screen (e.g. upgrading from a build before
  // PATCH_40) go through it once. Fails open on AsyncStorage error.
  if (permissionsDone === null) return <LoadingScreen />
  if (!permissionsDone) return <Redirect href="/(auth)/permissions-onboarding" />

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
