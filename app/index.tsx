import { Redirect } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ROLE_ROUTES } from '@/constants'

export default function Index() {
  const { isLoading, isAuthenticated, employee } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />

  const route = ROLE_ROUTES[employee?.role || 'member']
  return <Redirect href={route as any} />
}
