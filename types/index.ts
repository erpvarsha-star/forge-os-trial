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
  qr_verified: boolean
  checkpoint2_confirmed_by?: string
  checkpoint2_at?: string
  created_at: string
}

export interface Shift {
  id: string
  name: string
  start_time: string
  end_time: string
  department?: string
  is_night_shift: boolean
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
