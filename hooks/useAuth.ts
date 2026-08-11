import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee } from '@/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'

interface AuthState {
  session: any | null
  employee: Employee | null
  isLoading: boolean
  isAuthenticated: boolean
}

/**
 * Turns whatever the employee typed — an employee code or a mobile number —
 * into the synthetic email their Supabase auth user was provisioned with
 * (see scripts/PATCH_10_pin_auth_11Aug2026.sql).
 *
 * The lookup has to happen while still signed out, and RLS correctly hides the
 * employees table from anonymous callers, so this goes through the
 * SECURITY DEFINER resolver that returns only the email string.
 */
async function resolveIdentifier(identifier: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_login_identifier', {
    identifier: identifier.trim(),
  })
  if (error || !data) return null
  return data as string
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    employee: null,
    isLoading: true,
    isAuthenticated: false,
  })

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        await loadEmployee(session.user.id)
      } else {
        setState(s => ({ ...s, isLoading: false }))
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        loadEmployee(session.user.id)
      } else {
        setState({ session: null, employee: null, isLoading: false, isAuthenticated: false })
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  /**
   * Loads the employee row for a signed-in auth user.
   *
   * Keyed on auth_user_id, not phone: PIN login issues a JWT with no phone
   * claim at all, and roughly a third of employees have no phone number in the
   * database in the first place (see CLAUDE.md — VFL1527 is deliberately NULL
   * and only ~96 of 120 got numbers in PATCH_03), so phone was never a
   * workable identity key for everyone.
   */
  const loadEmployee = async (authUserId: string) => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()

    if (error || !data) {
      setState(s => ({ ...s, isLoading: false, isAuthenticated: false }))
      return
    }

    const employee = data as Employee
    await AsyncStorage.setItem('employee', JSON.stringify(employee))

    setState({
      session: await supabase.auth.getSession().then(r => r.data.session),
      employee,
      isLoading: false,
      isAuthenticated: true,
    })
  }

  /**
   * Employee code (or mobile number) + PIN.
   *
   * The PIN is the password on a real Supabase auth user, so sessions, refresh
   * and JWT handling are all stock Supabase rather than anything hand-rolled.
   */
  const signInWithPin = async (identifier: string, pin: string) => {
    const email = await resolveIdentifier(identifier)
    if (!email) {
      return { error: { message: 'NOT_FOUND' } as { message: string } }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: pin })
    if (error) {
      return { error: { message: 'BAD_PIN' } as { message: string } }
    }
    return { error: null }
  }

  /** Sets a new PIN, then clears must_change_pin for this employee only. */
  const changePin = async (newPin: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPin })
    if (error) return { error }

    // SECURITY DEFINER function rather than a direct update: an RLS policy
    // permissive enough to let employees update their own row would also let
    // them edit their own role, salary or supervisor_id.
    const { error: rpcError } = await supabase.rpc('mark_pin_changed')
    if (rpcError) return { error: rpcError }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) await loadEmployee(session.user.id)
    return { error: null }
  }

  // ---------------------------------------------------------------------
  // Phone OTP — retained as the fallback login mechanism, deliberately not
  // deleted. Unused while PIN login is active. See PATCH_10's rollback notes
  // and app/(auth)/login-otp.tsx.bak for the original screen.
  // ---------------------------------------------------------------------
  const signInWithOtp = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` })
    return { error }
  }

  const verifyOtp = async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`,
      token,
      type: 'sms',
    })

    if (!error && data.session) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase
          .from('employees')
          .update({ auth_user_id: session.user.id })
          .eq('phone', `+91${phone}`)
      }
    }

    return { data, error }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    await AsyncStorage.removeItem('employee')
    setState({ session: null, employee: null, isLoading: false, isAuthenticated: false })
    router.replace('/(auth)/login')
  }

  return { ...state, signInWithPin, changePin, signInWithOtp, verifyOtp, logout, loadEmployee }
}
