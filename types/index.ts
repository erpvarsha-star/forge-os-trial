export type Role = 'member' | 'supervisor' | 'manager' | 'plant_head' | 'hr_admin' | 'owner' | 'security_guard'

export interface Employee {
  id: string
  emp_code: string
  name: string
  phone: string
  role: Role
  department: string
  category: string
  language_preference: 'en' | 'hi'
  supervisor_id?: string
  manager_id?: string
  plant_head_id?: string
  salary?: number
  is_active: boolean
  /** Set by PATCH_10. True until the employee replaces their derived starting PIN. */
  must_change_pin?: boolean
  /** False for owner and remote-office employees who have no gate QR to scan. */
  requires_qr: boolean
  /** PATCH_71. Used when no employee_shifts row exists for a date, checked
   *  before the generic closest-shift inference — e.g. Kajal's "General
   *  (Pune)" 10am shift, not every General employee's 9am. */
  default_shift_id?: string
  /** PATCH_71. 0=Sunday..6=Saturday. Null means the company default,
   *  Friday, for everyone except the few people this has been set for. */
  weekly_off_day?: number | null
  created_at: string
  updated_at: string
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  status: 'P' | 'A' | 'L' | 'WO' | 'H' | 'HL'
  check_in_time?: string
  check_out_time?: string
  check_in_lat?: number
  check_in_lng?: number
  check_out_lat?: number
  check_out_lng?: number
  late_reason?: string
  late_minutes?: number
  hours_worked?: number
  qr_verified: boolean
  check_out_qr_verified?: boolean
  checkpoint2_confirmed_by?: string
  checkpoint2_at?: string
  created_at: string
}

export interface DeviceRegistration {
  id: string
  device_id: string
  employee_id: string
  registered_at: string
}

export interface Shift {
  id: string
  name: string
  start_time: string
  end_time: string
  department?: string
  is_night_shift: boolean
  late_grace_minutes?: number
}

export interface EmployeeShift {
  id: string
  employee_id: string
  shift_id: string
  date: string
  shift: Shift
}

export interface LeaveBalance {
  id: string
  employee_id: string
  earned_leave: number
  casual_leave: number
  sick_leave: number
  year: number
}

export interface LeaveRequest {
  id: string
  employee_id: string
  type: 'EL' | 'CL' | 'SL' | 'LWP'
  start_date: string
  end_date: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  created_at: string
  employee?: Employee
  /** Added by PATCH_53 (staged approval chains). Null on rows inserted before it. */
  approval_chain?: string[]
  current_stage?: number
}

export interface AdvanceRequest {
  id: string
  employee_id: string
  amount: number
  reason: string
  repayment_months: number
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  outstanding_balance: number
  created_at: string
  employee?: Employee
  /** Added by PATCH_53 (staged approval chains). Null on rows inserted before it. */
  approval_chain?: string[]
  current_stage?: number
}

export interface MaintenanceObservation {
  id: string
  employee_id: string
  area: string
  issue_description: string
  photo_url?: string
  status: 'open' | 'in_progress' | 'resolved'
  created_at: string
}

export interface MonthlyScore {
  id: string
  employee_id: string
  month: string
  year: number
  composite_score: number
  attendance_score: number
  on_time_score: number
  task_completion_score: number
  kpi_score: number
  production_score?: number
  brownie_points: number
  eotm_badge?: 'bronze' | 'gold' | null
  created_at: string
}

export interface FiveSSubmission {
  id: string
  employee_id: string
  challenge_id: string
  photo_url: string
  status: 'pending' | 'approved' | 'rejected'
  points_awarded: number
  verified_by?: string
  verified_at?: string
  created_at: string
  employee?: { name: string; emp_code: string }
}

export interface FiveSChallenge {
  id: string
  date: string
  challenge_text_hi: string
  challenge_text_en: string
  department?: string
}

export interface PayrollRecord {
  id: string
  employee_id: string
  month: string
  year: number
  basic: number
  hra: number
  conveyance: number
  special_allowance: number
  overtime: number
  pf: number
  esic: number
  pt: number
  advance_recovery: number
  tds: number
  production_incentive?: number
  net_pay: number
  created_at: string
  status?: 'draft' | 'final'
  // Attendance, added when real HR payroll sheets were imported (PATCH_54/56,
  // 28 Sep 2026) — not populated by run-payroll's original draft rows.
  working_days?: number
  present_days?: number
  week_off?: number
  el?: number
  cl?: number
  sl?: number
  ph?: number
  days_payable?: number
  ot_hours?: number
  // Staff-only allowances (null for Worker/Consultant rows)
  education?: number
  medical?: number
  professional_development?: number
  communication?: number
  uniform?: number
  washing?: number
  // Worker-only allowances (null for Staff/Consultant rows)
  heat_allowance?: number
  vda?: number
  production_allowance?: number
  production_efficiency_deduction?: number
  // Shared deduction/earning line items the real sheets carry
  canteen?: number
  society?: number
  mlwf?: number
  other_deduction?: number
  arrears?: number
  dispatch_incentive?: number
  other_allowance?: number
  leave_encashment?: number
  // Employer-side contributions — informational only, never part of the
  // employee's own deduction total; shown separately if shown at all.
  employer_pf?: number
  employer_esi?: number
  bonus?: number
  gratuity?: number
}

export interface PlantConfig {
  id: string
  plant_name: string
  latitude: number
  longitude: number
  geofence_radius_meters: number
  qr_secret_salt: string
}

export interface NotificationPayload {
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export interface Task {
  id: string
  title: string
  description?: string
  assignee_id: string
  assigner_id: string
  department?: string
  due_date?: string
  status: 'pending' | 'in_progress' | 'completed' | 'overdue'
  priority: 'low' | 'medium' | 'high'
  created_at: string
}

export interface CasualWorker {
  id: string
  supervisor_id: string
  date: string
  unskilled_count: number
  skilled_count: number
  operator_count: number
  created_at: string
}

export interface VehicleLogEntry {
  id: string
  vehicle_number: string
  driver_name?: string
  vendor_name?: string
  material?: string
  direction: 'inward' | 'outward'
  logged_by: string
  time_in?: string
  time_out?: string
  purpose?: string
  created_at: string
}

export interface EODConfirmation {
  id: string
  security_guard_id: string
  date: string
  inward_count: number
  outward_count: number
  mismatch_reason?: string
  confirmed_at: string
}

export interface DataCollectionSubmission {
  id: string
  supervisor_id: string
  shift_id: string
  date: string
  production_output: number
  quality_issues: number
  downtime_minutes: number
  operator_totals: number
  supervisor_total: number
  variance_percent: number
  created_at: string
}

export interface MRMReview {
  id: string
  department: string
  month: string
  year: number
  safety_score: number
  quality_score: number
  delivery_score: number
  cost_score: number
  morale_score: number
  submitted_by?: string
  submitted_at?: string
  status: 'pending' | 'submitted' | 'approved'
  created_at: string
}

export interface FraudAlert {
  id: string
  type: 'mock_location' | 'buddy_punching' | 'bulk_confirm'
  employee_id?: string
  description: string
  severity: 'low' | 'medium' | 'high'
  status: 'open' | 'investigating' | 'resolved'
  created_at: string
}

export interface EmailTask {
  id: string
  inbox: string
  subject: string
  sender: string
  priority: number
  status: 'unread' | 'read' | 'actioned'
  created_at: string
}

export interface PushToken {
  id: string
  user_id: string
  token: string
  platform: 'ios' | 'android'
  updated_at: string
}
