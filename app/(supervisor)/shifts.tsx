import { ShiftAllocationGrid } from '@/components/ShiftAllocationGrid'

// Scoped shift-allocation screen for supervisors named as an allocator in
// Yash's Shift_Planning_1.csv roster (28 Sep 2026) — currently just Sudeep
// Singh (Forge & Cutting). A supervisor not set as anyone's
// shift_allocator_id just sees an empty-team state.
export default function SupervisorShiftsScreen() {
  return <ShiftAllocationGrid />
}
