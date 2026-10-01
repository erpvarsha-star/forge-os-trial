export const SAFETY_TIPS = [
  {
    hi: 'हमेशा सही PPE पहनें - हेलमेट, सेफ्टी शूज और दस्ताने।',
    en: 'Always wear proper PPE - helmet, safety shoes, and gloves.',
  },
  {
    hi: 'मशीनरी चलाते समय ध्यान केंद्रित रखें। मोबाइल का उपयोग न करें।',
    en: 'Stay focused while operating machinery. No mobile phone use.',
  },
  {
    hi: 'रसायनों को सही लेबल के साथ स्टोर करें और MSDS पढ़ें।',
    en: 'Store chemicals with proper labels and read the MSDS.',
  },
  {
    hi: 'आग बुझाने का उपकरण जांचें और निकास मार्ग जानें।',
    en: 'Check fire extinguishers and know your escape routes.',
  },
  {
    hi: 'भारी वस्तुएं उठाते समय सही तकनीक का उपयोग करें।',
    en: 'Use proper lifting technique for heavy objects.',
  },
  {
    hi: 'किसी भी दुर्घटना की तुरंत रिपोर्ट करें, चाहे छोटी ही क्यों न हो।',
    en: 'Report any accident immediately, no matter how small.',
  },
]

export const LEAVE_TYPES = [
  { value: 'EL', label: 'Earned Leave (EL)', labelHi: 'अर्जित छुट्टी (EL)' },
  { value: 'CL', label: 'Casual Leave (CL)', labelHi: 'आकस्मिक छुट्टी (CL)' },
  { value: 'SL', label: 'Sick Leave (SL)', labelHi: 'बीमारी छुट्टी (SL)' },
  { value: 'LWP', label: 'Leave Without Pay', labelHi: 'बिना वेतन की छुट्टी' },
]

export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  P: 'bg-green-500',
  A: 'bg-red-500',
  L: 'bg-yellow-500',
  WO: 'bg-gray-400',
  H: 'bg-blue-400',
  HL: 'bg-orange-400',
}

// Statuses meaning the person was physically at work — 'L' is Late, not Leave.
export const PRESENT_STATUSES = ['P', 'L', 'HL']
export const isPresentStatus = (s?: string | null) => !!s && PRESENT_STATUSES.includes(s)

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  P: 'Present',
  A: 'Absent',
  L: 'Late',
  WO: 'Week Off',
  H: 'Holiday',
  HL: 'Half Day',
}

// Named individuals given access to a screen outside their role group, where
// the role-gate system (app/(role)/_layout.tsx + RoleGate) doesn't fit because
// the person needs it but isn't owner/plant_head/hr_admin themselves.
// Decision from Yash, 1 Oct 2026: Shift Check-in Summary goes to Owner +
// Plant Head + HR Admin (role-gated, normal screens in each of those groups)
// "+ Kajal" by name — Kajal Balkrishna Sutar (VFL1567), role='member',
// department='Administration'. Checked against emp_code, not employee_id,
// since emp_code is what this file documents and what a future session can
// verify without a DB round trip.
export const SHIFT_CHECKIN_SUMMARY_ALLOWED_EMP_CODES = ['VFL1567']

export const ROLE_ROUTES: Record<string, string> = {
  member: '/(worker)/home',
  supervisor: '/(supervisor)/dashboard',
  manager: '/(manager)/dashboard',
  plant_head: '/(plant-head)/dashboard',
  hr_admin: '/(hr-admin)/dashboard',
  owner: '/(owner)/dashboard',
  security_guard: '/(security)/dashboard',
}

export const ROLE_TABS: Record<string, string[]> = {
  member: ['home', 'attendance', 'score', 'leave', 'more'],
  supervisor: ['dashboard', 'team', 'tasks', 'approvals', 'more'],
  manager: ['dashboard', 'team', 'approvals', 'reports', 'more'],
  plant_head: ['dashboard', 'approvals', 'mrm', 'email', 'more'],
  hr_admin: ['dashboard', 'employees', 'payroll', 'shifts', 'more'],
  owner: ['dashboard', 'kpi', 'approvals', 'alerts', 'more'],
  security_guard: ['dashboard', 'team', 'eod-lock'],
}

export const SCORE_WEIGHTS = {
  member: {
    attendance: 0.25,
    onTime: 0.25,
    taskCompletion: 0.25,
    kpi: 0.25,
    production: 0,
  },
  operator: {
    attendance: 0.20,
    onTime: 0.20,
    taskCompletion: 0.20,
    kpi: 0.20,
    production: 0.20,
  },
  supervisor: {
    attendance: 0.20,
    onTime: 0.20,
    taskCompletion: 0.30,
    kpi: 0.30,
    production: 0,
  },
}

export const MAX_DAILY_OBSERVATIONS = 3

export const QR_VALIDITY_MINUTES = 5
