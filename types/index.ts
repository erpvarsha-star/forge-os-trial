export type UserRole = "member" | "supervisor" | "manager" | "plant_head" | "hr_admin" | "owner" | "security_guard";

export interface Employee {
  id: string; emp_code: string; name: string; phone: string;
  role: UserRole; department: string; category: string;
  language_preference: "hi" | "en"; supervisor_id?: string;
  department_id?: string; joining_date?: string; is_active: boolean;
}

export interface Shift {
  id: string; name: string; start_time: string; end_time: string; department_id?: string;
}

export interface AttendanceRecord {
  id: string; employee_id: string; date: string;
  status: "P" | "A" | "L" | "H" | "W" | "HD";
  check_in_time?: string; check_out_time?: string;
  check_in_lat?: number; check_in_lng?: number;
  check_out_lat?: number; check_out_lng?: number;
  is_late: boolean; late_reason?: string;
  checkpoint2_confirmed_by?: string; checkpoint2_at?: string;
}

export interface LeaveBalance {
  id: string; employee_id: string;
  el_balance: number; cl_balance: number; sl_balance: number; year: number;
}

export interface LeaveRequest {
  id: string; employee_id: string; leave_type: "EL" | "CL" | "SL";
  start_date: string; end_date: string; reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  applied_on: string; approved_by?: string; approved_on?: string;
  coverage_warning?: boolean;
}

export interface SalaryAdvance {
  id: string; employee_id: string; amount: number; reason: string;
  repayment_months: number; status: "pending" | "approved" | "rejected" | "disbursed";
  applied_on: string; approved_by?: string; outstanding_balance: number;
}

export interface MaintenanceObservation {
  id: string; employee_id: string; description: string;
  photo_url?: string; category: string;
  status: "open" | "in_progress" | "resolved"; created_at: string;
}

export interface MonthlyScore {
  id: string; employee_id: string; month: string; year: number;
  composite_score: number; attendance_score: number; on_time_score: number;
  task_completion_score: number; kpi_score: number; production_score?: number;
  brownie_points: number; eotm_badge?: "bronze" | "silver" | "gold" | null;
}

export interface FiveSChallenge {
  id: string; date: string; challenge_text_hi: string;
  challenge_text_en: string; department_id?: string; area: string;
}

export interface FiveSSubmission {
  id: string; challenge_id: string; employee_id: string;
  photo_url: string; status: "pending" | "approved" | "rejected";
  points: number; submitted_at: string; verified_by?: string; verified_at?: string;
}

export interface PayrollRecord {
  id: string; employee_id: string; month: string; year: number;
  basic: number; hra: number; conveyance: number; special_allowance: number;
  ot_amount: number; production_incentive?: number;
  pf_deduction: number; esic_deduction: number; pt_deduction: number;
  advance_recovery: number; tds: number; gross_earnings: number;
  total_deductions: number; net_pay: number; paid_days: number;
}

export interface Task {
  id: string; title: string; description: string;
  assigned_to: string; assigned_by: string; due_date: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
  priority: "low" | "medium" | "high"; category: string;
}

export interface MRMReview {
  id: string; department_id: string; month: string; year: number;
  status: "pending" | "submitted" | "reviewed";
  submitted_by?: string; submitted_on?: string; actions: MRMAction[];
}

export interface MRMAction {
  id: string; mrm_id: string; description: string;
  owner: string; target_date: string; status: "open" | "in_progress" | "closed";
}

export interface FraudAlert {
  id: string; type: "mock_location" | "buddy_punching" | "bulk_confirm";
  employee_id?: string; description: string;
  severity: "low" | "medium" | "high";
  status: "open" | "investigating" | "resolved"; created_at: string;
}

export interface DataCollectionSubmission {
  id: string; supervisor_id: string; date: string; shift_id: string;
  production_data: Record<string, number>; notes?: string;
  status: "draft" | "submitted";
}

export interface CasualWorker {
  id: string; supervisor_id: string; date: string;
  unskilled_count: number; skilled_count: number; operator_count: number;
}

export interface VehicleLogEntry {
  id: string; vehicle_number: string; driver_name?: string; vendor_name?: string;
  material?: string; direction: "inward" | "outward"; logged_by: string;
  time_in?: string; time_out?: string; purpose?: string; created_at: string;
}

export interface EODConfirmation {
  id: string; security_guard_id: string; date: string;
  inward_count: number; outward_count: number;
  mismatch_reason?: string; confirmed_at: string;
}