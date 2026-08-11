/**
 * Raw design-token values, mirroring tailwind.config.js.
 *
 * Most components should style via NativeWind `className`. This file exists
 * for the handful of places that need a real hex string instead of a class —
 * icon `color` props, `ActivityIndicator`, chart libraries, or inline
 * `style={{}}` — so those spots pull from the same palette instead of
 * hardcoding a slightly-different orange. Keep this in sync with
 * tailwind.config.js by hand; there is no build step that derives one from
 * the other.
 */

export const BRAND = {
  50: '#FFF4EB',
  100: '#FFE4CC',
  200: '#FFC699',
  300: '#FFA35C',
  400: '#F98A33',
  500: '#EF6E0C',
  600: '#E65C00',
  700: '#BA4A02',
  800: '#933C08',
  900: '#78330C',
} as const

export const INK = {
  50: '#F6F7F9',
  100: '#ECEEF2',
  200: '#D8DCE3',
  300: '#B9C0CC',
  400: '#8B93A3',
  500: '#646D80',
  600: '#4B5265',
  700: '#363C4C',
  800: '#22262F',
  900: '#14161C',
} as const

export type AttendanceStatusCode = 'P' | 'A' | 'L' | 'WO' | 'H' | 'HL'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

interface StatusTone {
  fg: string
  bg: string
  /** Tailwind class names for the same tone, for callers that can use className. */
  className: { fg: string; bg: string; border: string }
}

function tone(fg: string, bg: string, name: string): StatusTone {
  return {
    fg,
    bg,
    className: {
      fg: `text-status-${name}`,
      bg: `bg-status-${name}-bg`,
      border: `border-status-${name}`,
    },
  }
}

export const STATUS = {
  present: tone('#0E7A44', '#E1F5EA', 'present'),
  absent: tone('#C22030', '#FBE3E5', 'absent'),
  late: tone('#A6650A', '#FBEDD0', 'late'),
  weekoff: tone('#5B6373', '#EBEDF1', 'weekoff'),
  holiday: tone('#5B48B0', '#EBE4F8', 'holiday'),
  halfday: tone('#A6540A', '#FBE7D0', 'halfday'),
  pending: tone('#A6650A', '#FBEDD0', 'pending'),
  approved: tone('#0E7A44', '#E1F5EA', 'approved'),
  rejected: tone('#C22030', '#FBE3E5', 'rejected'),
} as const

export type StatusTokenKey = keyof typeof STATUS

/** Maps an attendance_records.status code (P/A/L/WO/H/HL) to its status token key. */
export const ATTENDANCE_STATUS_TOKEN: Record<AttendanceStatusCode, StatusTokenKey> = {
  P: 'present',
  A: 'absent',
  L: 'late',
  WO: 'weekoff',
  H: 'holiday',
  HL: 'halfday',
}

/** Maps a leave/advance request status to its status token key. */
export const APPROVAL_STATUS_TOKEN: Record<ApprovalStatus, StatusTokenKey> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
}
