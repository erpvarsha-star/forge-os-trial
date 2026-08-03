import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MonthlyScore } from '@/types'

export function useScore(employeeId: string) {
  const [score, setScore] = useState<MonthlyScore | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      if (!employeeId) return
      setIsLoading(true)
      const now = new Date()
      const { data } = await supabase
        .from('monthly_scores')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('month', String(now.getMonth() + 1).padStart(2, '0'))
        .eq('year', now.getFullYear())
        .single()
      if (data) setScore(data as MonthlyScore)
      setIsLoading(false)
    }
    fetch()
  }, [employeeId])

  return { score, isLoading }
}
