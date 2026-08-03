/**
 * Forge OS — TypeScript types mirroring supabase/migrations/20260803090000_initial_schema.sql.
 *
 * Hand-written to match the schema (not `supabase gen types`, since this repo
 * doesn't have a live project ref to generate against yet). Once the project
 * is created, prefer regenerating with:
 *   supabase gen types typescript --project-id <ref> > types/database.ts
 * and re-apply any hand additions below.
 */

// ---------------------------------------------------------------------------
// Enums (must match `create type ... as enum (...)` in supabase/migrations/20260803090000_initial_schema.sql)
// ---------------------------------------------------------------------------

export type RoleEnum =
  | 'owner'
  | 'plant_head'
  | 'manager'
  | 'supervisor'
  | 'member'
  | 'hr_admin'
  | 'security_guard'
  | 'ai_agent';

export type AttendanceStatusEnum = 'P' | 'LC' | 'EC' | 'OT' | 'A' | 'H' | 'L' | 'WO';
export type LeaveTypeEnum = 'EL' | 'CL' | 'SL' | 'CO' | 'ML';
export type LeaveStatusEnum =
  | 'pending'
  | 'manager_approved'
  | 'rejected'
  | 'escalated_to_plant_head'
  | 'awaiting_owner_confirmation'
  | 'approved';
export type ShiftTypeEnum = 'morning' | 'evening' | 'night' | 'general';
export type AdvanceSafetyFlagEnum = 'none' | 'warning_over_30pct' | 'auto_reject_over_50pct';
export type AdvanceStatusEnum =
  | 'pending'
  | 'manager_approved'
  | 'hr_reviewed'
  | 'awaiting_owner_approval'
  | 'approved'
  | 'rejected'
  | 'auto_rejected';
export type TaskTypeEnum = 'daily' | 'weekly' | 'assigned';
export type TaskStatusEnum = 'open' | 'in_progress' | 'done' | 'overdue' | 'escalated';
export type ProductionEntryTypeEnum = 'hourly' | 'two_hourly' | 'none';
export type ValidationStatusEnum = 'pending' | 'supervisor_validated' | 'manager_validated' | 'flagged';
export type VehicleDirectionEnum = 'inward' | 'outward';
export type QcStatusEnum = 'pending' | 'approved' | 'rejected';
export type MatchStatusEnum = 'pending' | 'matched' | 'exception';
export type EmailUrgencyEnum = 'customer_facing' | 'internal' | 'other';
export type EmailTaskStatusEnum = 'pending' | 'replied' | 'escalated';
export type MrmStatusEnum = 'pending' | 'submitted' | 'reviewed' | 'noted';
export type FraudFlagTypeEnum = 'bulk_confirmation' | 'mock_location' | 'gps_outside_radius';
export type FraudFlagStatusEnum = 'open' | 'reviewed' | 'dismissed';
export type RegularisationStatusEnum = 'pending' | 'approved' | 'rejected' | 'expired';
export type WarningLevelEnum = 'warning_1' | 'final_warning';
export type LanguageEnum = 'en' | 'hi';

// ---------------------------------------------------------------------------
// Table row shapes
// ---------------------------------------------------------------------------

export interface DepartmentRow {
  id: string;
  name: string;
  short_code: string;
  is_production: boolean;
  created_at: string;
}

export interface SalaryStructure {
  basic?: number;
  hra?: number;
  conveyance?: number;
  washing?: number;
  education?: number;
  vda?: number;
  heat?: number;
  dispatch_incentive?: number;
  production_allowance?: number;
}

export interface EmployeeRow {
  id: string;
  auth_user_id: string | null;
  employee_code: string;
  full_name: string;
  full_name_hi: string | null;
  phone: string;
  role: RoleEnum;
  department_id: string | null;
  designation: string | null;
  reporting_manager_id: string | null;
  date_of_joining: string | null;
  probation_end_date: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  pf_number: string | null;
  uan: string | null;
  esic_number: string | null;
  pan: string | null;
  aadhaar_last4: string | null;
  salary_structure: SalaryStructure;
  language_pref: LanguageEnum;
  avatar_url: string | null;
  is_active: boolean;
  activated_at: string | null;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRow {
  id: string;
  employee_id: string;
  shift_date: string;
  shift_type: ShiftTypeEnum;
  status: AttendanceStatusEnum;
  checkpoint1_at: string | null;
  checkpoint1_gps_lat: number | null;
  checkpoint1_gps_lng: number | null;
  checkpoint1_distance_meters: number | null;
  checkpoint1_qr_code: string | null;
  mock_location_detected: boolean;
  checkpoint2_at: string | null;
  checkpoint2_confirmed_by: string | null;
  checkpoint3_at: string | null;
  checkpoint3_confirmed_by: string | null;
  late_minutes: number;
  late_reason: string | null;
  is_regularised: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShiftRow {
  id: string;
  employee_id: string;
  shift_date: string;
  shift_type: ShiftTypeEnum;
  assigned_by: string | null;
  created_at: string;
}

export interface LeaveBalanceRow {
  id: string;
  employee_id: string;
  year: number;
  el_balance: number;
  cl_balance: number;
  sl_balance: number;
  updated_at: string;
}

export interface CompOffBalanceRow {
  id: string;
  employee_id: string;
  earned_date: string;
  expiry_date: string;
  reason: string | null;
  is_used: boolean;
  used_in_leave_request_id: string | null;
  created_at: string;
}

export interface LeaveRequestRow {
  id: string;
  employee_id: string;
  leave_type: LeaveTypeEnum;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: LeaveStatusEnum;
  coverage_pct_at_request: number | null;
  coverage_warning_shown: boolean;
  owner_confirmation_required: boolean;
  reporting_manager_id: string | null;
  manager_action: string | null;
  manager_action_at: string | null;
  manager_action_reason: string | null;
  plant_head_action: string | null;
  plant_head_action_at: string | null;
  plant_head_action_reason: string | null;
  owner_confirmed_by: string | null;
  owner_confirmed_at: string | null;
  escalated_at: string | null;
  comp_off_balance_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryAdvanceRow {
  id: string;
  employee_id: string;
  amount: number;
  repayment_months: 3 | 6 | 12;
  reason: string | null;
  monthly_deduction: number | null;
  outstanding_balance: number | null;
  pct_of_gross: number | null;
  safety_flag: AdvanceSafetyFlagEnum;
  reporting_manager_action: string | null;
  reporting_manager_action_at: string | null;
  hr_admin_action: string | null;
  hr_admin_action_at: string | null;
  hr_admin_override: boolean;
  owner_action: string | null;
  owner_action_at: string | null;
  status: AdvanceStatusEnum;
  created_at: string;
  updated_at: string;
}

export interface HourlyProductionRow {
  id: string;
  employee_id: string;
  department_id: string | null;
  machine_id: string;
  part_master_id: string | null;
  shift_date: string;
  shift_type: ShiftTypeEnum;
  hour_slot: number;
  parts_made: number;
  entry_type: ProductionEntryTypeEnum;
  target_parts: number | null;
  efficiency_pct: number | null;
  status: ValidationStatusEnum;
  supervisor_validated_by: string | null;
  supervisor_validated_at: string | null;
  manager_validated_by: string | null;
  manager_validated_at: string | null;
  incentive_flag: boolean;
  alert_flag: boolean;
  points_awarded: number;
  created_at: string;
}

export interface MaintenanceObservationRow {
  id: string;
  employee_id: string;
  department_id: string | null;
  shift_date: string;
  shift_type: ShiftTypeEnum;
  observation_type: string;
  electricity_start_reading: number | null;
  electricity_end_reading: number | null;
  oil_machine: string | null;
  oil_type: string | null;
  oil_qty: number | null;
  notes: string | null;
  urgency: string | null;
  points_awarded: number;
  created_at: string;
}

export interface CasualWorkersRow {
  id: string;
  supervisor_id: string;
  department_id: string | null;
  shift_date: string;
  shift_type: ShiftTypeEnum;
  unskilled_count: number;
  skilled_count: number;
  operator_count: number;
  unskilled_rate: number | null;
  skilled_rate: number | null;
  operator_rate: number | null;
  created_at: string;
}

export interface ShiftReportRow {
  id: string;
  supervisor_id: string;
  department_id: string | null;
  shift_date: string;
  shift_type: ShiftTypeEnum;
  summary: string | null;
  issues: string | null;
  submitted_at: string;
  points_awarded: number;
}

export interface MonthlyScoreRow {
  id: string;
  employee_id: string;
  year: number;
  month: number;
  attendance_score: number;
  ontime_score: number;
  task_score: number;
  kpi_score: number;
  production_score: number;
  team_control_score: number;
  brownie_points: number;
  composite_score: number;
  eotm_category: string | null;
  eotm_rank: number | null;
  eotm_gap_to_leader: number | null;
  eotm_winner: boolean;
  badge: string | null;
  ai_suggestion: string | null;
  ai_suggestion_generated_at: string | null;
  computed_at: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  assigned_by: string;
  assigned_to: string;
  task_type: TaskTypeEnum;
  points: number;
  priority: string;
  due_date: string | null;
  status: TaskStatusEnum;
  escalation_level: number;
  escalated_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  employee_id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
}

export interface PushTokenRow {
  id: string;
  employee_id: string;
  expo_push_token: string;
  device_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiveSChallengeRow {
  id: string;
  department_id: string | null;
  shift_type: ShiftTypeEnum | null;
  challenge_date: string;
  challenge_text_en: string;
  challenge_text_hi: string;
  category: string;
  points: number;
  created_at: string;
}

export interface FiveSChallengeCompletionRow {
  id: string;
  challenge_id: string;
  employee_id: string;
  photo_url: string | null;
  completed_at: string;
  points_awarded: number;
}

export interface MrmReviewRow {
  id: string;
  department_id: string;
  year: number;
  month: number;
  submitted_by: string | null;
  kpi_achievements: string | null;
  highlights: string | null;
  challenges: string | null;
  action_items: string | null;
  manpower_status: string | null;
  status: MrmStatusEnum;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  noted_by: string | null;
  noted_at: string | null;
  escalated_at: string | null;
  created_at: string;
}

export interface VehicleLogRow {
  id: string;
  vehicle_number: string;
  driver_name: string | null;
  vendor_name: string | null;
  material: string | null;
  direction: VehicleDirectionEnum;
  logged_by: string;
  time_in: string | null;
  time_out: string | null;
  purpose: string | null;
  linked_grn_id: string | null;
  created_at: string;
}

export interface GoodsReceiptNoteRow {
  id: string;
  po_id: string | null;
  vehicle_log_id: string | null;
  received_qty: number;
  condition: string | null;
  challan_number: string | null;
  qc_status: QcStatusEnum;
  qc_notes: string | null;
  qc_by: string | null;
  raised_by: string;
  created_at: string;
}

export interface ThreeWayMatchRow {
  id: string;
  po_id: string;
  grn_id: string;
  po_price: number;
  invoice_price: number;
  grn_qty: number;
  invoice_qty: number;
  qc_status: QcStatusEnum;
  match_status: MatchStatusEnum;
  checked_by: string | null;
  payment_released: boolean;
  payment_released_by: string | null;
  payment_released_at: string | null;
  created_at: string;
}

export interface EmailTaskRow {
  id: string;
  gmail_message_id: string | null;
  inbox_email: string;
  assigned_to: string | null;
  subject: string | null;
  snippet: string | null;
  urgency: EmailUrgencyEnum;
  deadline_at: string | null;
  status: EmailTaskStatusEnum;
  replied_at: string | null;
  escalated_at: string | null;
  created_at: string;
}

export interface FraudFlagRow {
  id: string;
  flag_type: FraudFlagTypeEnum;
  supervisor_id: string | null;
  employee_id: string | null;
  confirmations_count: number | null;
  seconds_elapsed: number | null;
  details: Record<string, unknown>;
  status: FraudFlagStatusEnum;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AttendanceRegularisationRow {
  id: string;
  employee_id: string;
  attendance_date: string;
  requested_status: AttendanceStatusEnum;
  reason: string;
  shift_worked: ShiftTypeEnum | null;
  status: RegularisationStatusEnum;
  reporting_manager_id: string | null;
  action_at: string | null;
  action_reason: string | null;
  expires_at: string;
  created_at: string;
}

export interface AttendanceWarningRow {
  id: string;
  employee_id: string;
  warning_level: WarningLevelEnum;
  reason: string;
  month: number;
  year: number;
  acknowledged: boolean;
  acknowledged_at: string | null;
  requires_owner_approval: boolean;
  owner_approved: boolean | null;
  owner_approved_by: string | null;
  owner_approved_at: string | null;
  created_at: string;
}

export interface PlantConfigRow {
  config_key: string;
  config_value: unknown;
  description: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Generic Row/Insert/Update helper + Database shape (supabase-js compatible)
// ---------------------------------------------------------------------------

type TableDef<Row, DefaultedKeys extends keyof Row> = {
  Row: Row;
  Insert: Omit<Row, DefaultedKeys> & Partial<Pick<Row, DefaultedKeys>>;
  Update: Partial<Row>;
};

export interface Database {
  public: {
    Tables: {
      departments: TableDef<DepartmentRow, 'id' | 'created_at'>;
      employees: TableDef<EmployeeRow, 'id' | 'created_at' | 'updated_at' | 'is_active' | 'salary_structure' | 'language_pref'>;
      attendance: TableDef<AttendanceRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'late_minutes' | 'is_regularised' | 'mock_location_detected'>;
      shifts: TableDef<ShiftRow, 'id' | 'created_at'>;
      leave_balances: TableDef<LeaveBalanceRow, 'id' | 'updated_at' | 'el_balance' | 'cl_balance' | 'sl_balance'>;
      comp_off_balance: TableDef<CompOffBalanceRow, 'id' | 'created_at' | 'is_used'>;
      leave_requests: TableDef<LeaveRequestRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'coverage_warning_shown' | 'owner_confirmation_required'>;
      salary_advances: TableDef<SalaryAdvanceRow, 'id' | 'created_at' | 'updated_at' | 'safety_flag' | 'status' | 'hr_admin_override'>;
      hourly_production: TableDef<HourlyProductionRow, 'id' | 'created_at' | 'entry_type' | 'status' | 'incentive_flag' | 'alert_flag' | 'points_awarded'>;
      maintenance_observations: TableDef<MaintenanceObservationRow, 'id' | 'created_at' | 'points_awarded'>;
      casual_workers: TableDef<CasualWorkersRow, 'id' | 'created_at' | 'unskilled_count' | 'skilled_count' | 'operator_count'>;
      shift_reports: TableDef<ShiftReportRow, 'id' | 'submitted_at' | 'points_awarded'>;
      monthly_scores: TableDef<MonthlyScoreRow, 'id' | 'computed_at' | 'attendance_score' | 'ontime_score' | 'task_score' | 'kpi_score' | 'production_score' | 'team_control_score' | 'brownie_points' | 'composite_score' | 'eotm_winner'>;
      tasks: TableDef<TaskRow, 'id' | 'created_at' | 'status' | 'escalation_level' | 'points' | 'priority'>;
      notifications: TableDef<NotificationRow, 'id' | 'created_at' | 'is_read'>;
      push_tokens: TableDef<PushTokenRow, 'id' | 'created_at' | 'updated_at'>;
      five_s_challenges: TableDef<FiveSChallengeRow, 'id' | 'created_at' | 'points'>;
      five_s_challenge_completions: TableDef<FiveSChallengeCompletionRow, 'id' | 'completed_at' | 'points_awarded'>;
      mrm_reviews: TableDef<MrmReviewRow, 'id' | 'created_at' | 'status'>;
      vehicle_log: TableDef<VehicleLogRow, 'id' | 'created_at'>;
      goods_receipt_notes: TableDef<GoodsReceiptNoteRow, 'id' | 'created_at' | 'qc_status'>;
      three_way_match: TableDef<ThreeWayMatchRow, 'id' | 'created_at' | 'match_status' | 'payment_released'>;
      email_tasks: TableDef<EmailTaskRow, 'id' | 'created_at' | 'status'>;
      fraud_flags: TableDef<FraudFlagRow, 'id' | 'created_at' | 'status' | 'details'>;
      attendance_regularisation: TableDef<AttendanceRegularisationRow, 'id' | 'created_at' | 'status' | 'expires_at'>;
      attendance_warnings: TableDef<AttendanceWarningRow, 'id' | 'created_at' | 'acknowledged' | 'requires_owner_approval'>;
      plant_config: TableDef<PlantConfigRow, 'updated_at'>;
    };
  };
}
