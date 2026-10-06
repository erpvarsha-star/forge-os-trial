import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { NeedsYourCallShiftItem, Shift, ShiftReviewOutcome } from '@/types'

// Owner-only review queue for employee_shifts rows the system guessed on
// (inferred for an unassigned check-in, or reclassified for 12h+
// overtime) rather than HR allocating — see needs_your_call_shifts_for_me()
// (PATCH_78). Fraud alert resolution is the other half of "Needs Your
// Call" and lives separately in app/(owner)/alerts.tsx, already shipped.
export function useNeedsYourCall() {
  const [items, setItems] = useState<NeedsYourCallShiftItem[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    const [{ data }, { data: shiftData }] = await Promise.all([
      supabase.rpc('needs_your_call_shifts_for_me'),
      supabase.from('shifts').select('*'),
    ])
    setItems((data || []) as NeedsYourCallShiftItem[])
    setShifts((shiftData || []) as Shift[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const resolve = async (
    id: string,
    outcome: ShiftReviewOutcome,
    correctedShiftId?: string,
    note?: string
  ) => {
    setActingId(id)
    const { error } = await supabase.rpc('resolve_shift_assignment', {
      p_employee_shift_id: id,
      p_outcome: outcome,
      p_corrected_shift_id: correctedShiftId || null,
      p_note: note || null,
    })
    setActingId(null)
    if (!error) await fetchItems()
    return { error }
  }

  return { items, shifts, isLoading, actingId, resolve, refresh: fetchItems }
}
