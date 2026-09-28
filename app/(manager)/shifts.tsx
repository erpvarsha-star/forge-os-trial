import { ShiftAllocationGrid } from '@/components/ShiftAllocationGrid'

// Scoped shift-allocation screen for managers named as an allocator in
// Yash's Shift_Planning_1.csv roster (28 Sep 2026) — e.g. Bharat Salve,
// Abhimanyu Kakde, Bhupendra Bharude, Balasaheb Todmal, CON12 Sadashiv
// Soddy. A manager not set as anyone's shift_allocator_id just sees an
// empty-team state, same as (supervisor)/approvals.tsx's "moved" pattern.
export default function ManagerShiftsScreen() {
  return <ShiftAllocationGrid />
}
