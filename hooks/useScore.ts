import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MonthlyScore } from '@/types'
import { istMonthYear } from '@/lib/istDate'

export function useScore(employeeId: string) {
  const [score, setScore] = useState<MonthlyScore | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      if (!employeeId) return
      setIsLoading(true)
      const { month, year } = istMonthYear()
      const { data } = await supabase
        .from('monthly_scores')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('month', month)
        .eq('year', year)
        .single()
      if (data) setScore(data as MonthlyScore)
      setIsLoading(false)
    }
    fetch()
  }, [employeeId])

  return { score, isLoading }
}
