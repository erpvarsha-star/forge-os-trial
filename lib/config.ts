/**
 * Forge OS — central plant configuration.
 *
 * Mirrors the seed rows in `plant_config` (scripts/schema.sql) so the app has
 * synchronous access to constants that rarely change, without a network
 * round-trip on every screen. Values here MUST stay in sync with the
 * `plant_config` table — if you change one, change both.
 *
 * Source: ForgeOS Master System Definition v1.0, Section 2 (Roles),
 * Section 3 (Workflow Library), Section 5 (Tech Stack and Architecture).
 */

export type RoleKey =
  | 'owner'
  | 'plant_head'
  | 'manager'
  | 'supervisor'
  | 'member'
  | 'hr_admin'
  | 'security_guard'
  | 'ai_agent';

export type ShiftType = 'morning' | 'evening' | 'night' | 'general';

export type AttendanceStatus = 'P' | 'LC' | 'EC' | 'OT' | 'A' | 'H' | 'L' | 'WO';

export const PLANT = {
  code: 'VFL-AKT',
  name: 'Varsha Forgings Pvt Ltd',
  shortName: 'VFPL',
  location: 'B7, M.I.D.C, Waluj, Aurangabad, Maharashtra',
  gps: {
    lat: 19.8383935925407,
    lng: 75.23638998304483,
    geofenceMeters: 100,
  },
} as const;

export const ROLE_COLORS: Record<RoleKey, string> = {
  owner: '#E87722',
  plant_head: '#185FA5',
  manager: '#2B2B2B', // dark base — department header shows dept colour on top
  supervisor: '#E87722', // orange header pill with department name
  member: '#0F6E56',
  hr_admin: '#7B3FA0',
  security_guard: '#455A64',
  ai_agent: '#8E8E8E',
};

export const ROLE_LABELS: Record<RoleKey, { en: string; hi: string }> = {
  owner: { en: 'Owner', hi: 'मालिक' },
  plant_head: { en: 'Plant Head', hi: 'प्लांट हेड' },
  manager: { en: 'Manager', hi: 'मैनेजर' },
  supervisor: { en: 'Supervisor', hi: 'सुपरवाइज़र' },
  member: { en: 'Member', hi: 'सदस्य' }, // NEVER "Worker"
  hr_admin: { en: 'HR Admin', hi: 'एचआर एडमिन' },
  security_guard: { en: 'Security Guard', hi: 'सुरक्षा गार्ड' },
  ai_agent: { en: 'Varsha AI', hi: 'वर्षा एआई' },
};

// Who confirms checkpoint 2 / role-level check-in confirmation chain (Section 2)
export const CHECKIN_CONFIRMED_BY: Record<RoleKey, RoleKey | null> = {
  owner: 'plant_head',
  plant_head: 'owner',
  manager: 'plant_head',
  supervisor: 'manager',
  member: 'supervisor',
  hr_admin: 'manager', // Commercial Head, modelled as manager role
  security_guard: 'hr_admin',
  ai_agent: null,
};

export const ATTENDANCE = {
  lateGraceMinutes: 30,
  checkpoint2WindowMinutes: 90,
  bulkConfirmationThreshold: { count: 10, seconds: 90 },
  warning1AtLcCount: 4,
  finalWarningAtLcCount: 5,
  lateReasons: ['Traffic', 'Health', 'Family', 'Vehicle', 'Other'] as const,
  statusLabels: {
    P: { en: 'Present', hi: 'उपस्थित' },
    LC: { en: 'Late Coming', hi: 'देर से आना' },
    EC: { en: 'Early Coming', hi: 'जल्दी आना' },
    OT: { en: 'Overtime', hi: 'ओवरटाइम' },
    A: { en: 'Absent', hi: 'अनुपस्थित' },
    H: { en: 'Holiday', hi: 'छुट्टी का दिन' },
    L: { en: 'Leave', hi: 'अवकाश' },
    WO: { en: 'Weekly Off', hi: 'साप्ताहिक अवकाश' },
  } as Record<AttendanceStatus, { en: string; hi: string }>,
};

export const LEAVE = {
  annualEntitlement: { EL: 12, CL: 8, SL: 6 },
  compOffExpiryDays: 90,
  maternityWeeks: 26,
  coverageWarningPct: 70,
  coverageOwnerConfirmPct: 50,
  autoEscalateHours: 48,
};

export const ADVANCE = {
  warningPct: 30,
  autoRejectPct: 50,
  ownerApprovalThresholdInr: 10000,
  repaymentMonthOptions: [3, 6, 12] as const,
};

export const PRODUCTION = {
  entryPoints: { hourly: 1, twoHourly: 0.8, none: 0 },
  efficiencyBands: {
    incentiveAbovePct: 100,
    fullPointsMinPct: 90,
    partialPointsMinPct: 80, // 80-90% = 80% points
    alertBelowPct: 80,
  },
  machines: ['CNC', 'VMC', 'Hobbing', 'Forge Hammer', 'Press', 'Heat Treatment'] as const,
};

export const SHIFT_TIMES: Record<ShiftType, string> = {
  morning: '06:00',
  evening: '14:00',
  night: '22:00',
  general: '09:00',
};

export const PAYROLL = {
  pfRatePct: 12,
  esicRatePct: 0.75,
  esicGrossCeiling: 21000,
  ptAmount: 200,
  mlwfAmount: 25,
  components: [
    'basic',
    'hra',
    'conveyance',
    'washing',
    'education',
    'vda',
    'heat',
    'ot',
    'dispatchIncentive',
    'productionAllowance',
  ] as const,
};

export const MRM = {
  departments: [
    'Production',
    'Quality',
    'Maintenance',
    'Purchase & Stores',
    'Design',
    'Sales & Logistics',
    'Accounts & Finance',
    'HR',
    'Administration',
  ] as const,
  reminderStartDay: 8,
  dueDay: 10,
  dueTimeIst: '17:00',
  statuses: ['pending', 'submitted', 'reviewed', 'noted'] as const,
};

export const EMAIL_TASKS = {
  deadlineHours: {
    customer_facing: 2,
    internal: 4,
    other: 8,
  },
  inboxCount: 25,
};

export const SCORE_WEIGHTS: Record<
  'member' | 'operator' | 'supervisor' | 'manager',
  { attendance: number; ontime: number; task: number; kpi: number; production: number; teamControl: number }
> = {
  member: { attendance: 30, ontime: 10, task: 20, kpi: 20, production: 20, teamControl: 0 },
  operator: { attendance: 20, ontime: 10, task: 10, kpi: 20, production: 30, teamControl: 10 },
  supervisor: { attendance: 25, ontime: 10, task: 25, kpi: 30, production: 0, teamControl: 10 },
  manager: { attendance: 20, ontime: 10, task: 25, kpi: 35, production: 0, teamControl: 10 },
};

export const BADGES = {
  bronzeDays: 30,
  silverDays: 60,
  goldDays: 90,
  goldTopPct: 10,
};

export const EOTM_CATEGORIES = ['best_member', 'best_operator', 'best_supervisor', 'best_manager'] as const;

export const DESIGN = {
  primaryColor: '#E87722',
  minButtonHeightPx: 56,
  minTouchTargetPx: 44,
};

export const NIGHTLY_SCORING_TIME_IST = '22:00';
