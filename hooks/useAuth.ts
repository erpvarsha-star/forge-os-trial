import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, Role } from '@/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'

interface AuthState {
  session: any | null
  employee: Employee | null
  isLoading: boolean
  isAuthenticated: boolean
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
      if (session?.user.phone) {
        await loadEmployee(session.user.phone)
      } else {
        setState(s => ({ ...s, isLoading: false }))
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.phone) {
        loadEmployee(session.user.phone)
      } else {
        setState({ session: null, employee: null, isLoading: false, isAuthenticated: false })
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const loadEmployee = async (phone: string) => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('phone', phone)
      .single()

    if (error || !data) {
      setState(s => ({ ...s, isLoading: false }))
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

  const signInWithOtp = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+91${phone}`,
    })
    return { error }
  }

  const verifyOtp = async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`,
      token,
      type: 'sms',
    })

    if (!error && data.session) {
      const {
        data: { session },
      } = await supabase.auth.getSession()
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

  return { ...state, signInWithOtp, verifyOtp, logout, loadEmployee }
}
