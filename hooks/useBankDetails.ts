import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface MissingBankRow {
  structure_id: string
  emp_code: string
  name: string
  department: string | null
  bank_name: string | null
  account_no: string | null
  ifsc: string | null
  uan: string | null
  pan: string | null
  missing: string[]
}

export interface BankDetailsInput {
  bank_name: string | null
  account_no: string | null
  ifsc: string | null
  uan: string | null
  pan: string | null
}

/** Rows of employees whose bank/UAN/PAN details are incomplete (hr_admin/owner only, RPC-enforced). */
export function useBankDetails() {
  const [rows, setRows] = useState<MissingBankRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    const { data, error } = await supabase.rpc('list_missing_bank_details')
    if (error) {
      setLoadError(error.message)
    } else {
      setLoadError(null)
      setRows((data ?? []) as MissingBankRow[])
    }
    setIsLoading(false)
    setIsRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  /** Returns an error message (server text) or null on success. Removes the row on success. */
  const save = useCallback(async (structureId: string, input: BankDetailsInput): Promise<string | null> => {
    const { error } = await supabase.rpc('hr_set_bank_details', {
      p_structure_id: structureId,
      p_bank_name: input.bank_name,
      p_account_no: input.account_no,
      p_ifsc: input.ifsc,
      p_uan: input.uan,
      p_pan: input.pan,
    })
    if (error) return error.message
    setRows(prev => prev.filter(r => r.structure_id !== structureId))
    return null
  }, [])

  return { rows, isLoading, isRefreshing, loadError, refresh: () => load(true), save }
}
