import React from 'react'
import { Redirect } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { useViewAsStore } from '@/hooks/useViewAs'
import { useEffectiveIdentity } from '@/hooks/useEffectiveIdentity'
import { LoadingScreen } from '@/components/LoadingScreen'
import type { Role } from '@/types'

/**
 * Route-group guard.
 *
 * WHY: `app/index.tsx` was the ONLY auth check in the app. It routes you to
 * the right group on launch, but it does not stop you being *in* a group —
 * so any deep link, any stale navigation state restored after a cold start,
 * or any `router.push` with the wrong path dropped you straight onto another
 * role's screens with no check at all. The screens themselves would then
 * render whatever RLS let through, which for a member is not much, but the
 * layout, the tabs and the actions were all there.
 *
 * This closes that: each group layout declares which roles may render it.
 *
 * ⚠ STILL NOT THE SECURITY BOUNDARY. RLS is. A guard in the client can always
 * be bypassed by someone editing the bundle, so this stops accidents and
 * wrong turns, not attackers. The reason it is worth having anyway is that
 * "supervisor screens rendered for a member, all queries returning empty" is
 * indistinguishable from a broken app, and generates support calls.
 *
 * Checks the EFFECTIVE role, so an admin using "view as" passes the gate for
 * the group they switched into.
 */
export function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { isLoading, isAuthenticated, employee } = useAuth()
  const isHydrated = useViewAsStore(s => s.isHydrated)
  const { role } = useEffectiveIdentity()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  // Same gate as the router: a guessable starting PIN must not reach data.
  if (employee?.must_change_pin) return <Redirect href="/(auth)/change-pin" />

  // Before hydration the effective role is the real one, which would bounce an
  // admin out of the group they are legitimately viewing. Wait it out.
  if (!isHydrated) return <LoadingScreen />

  // Back to the router rather than to a hardcoded screen, so the redirect
  // stays correct if role routing ever changes.
  if (!role || !allow.includes(role)) return <Redirect href="/" />

  return <>{children}</>
}
