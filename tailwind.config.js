/** @type {import('tailwindcss').Config} */

// ---------------------------------------------------------------------------
// Forge OS design tokens
//
// Brand accent is #E65C00 (set as brand-600) — used sparingly for primary
// actions and key data, not as a background wash. Structure is carried by
// the neutral `ink` scale. Semantic `status` tokens back the attendance
// states (P/A/L/WO/H/HL) and approval states (pending/approved/rejected)
// that recur across almost every screen — see constants/index.ts for the
// attendance status codes these correspond to.
// ---------------------------------------------------------------------------

const brand = {
  50: '#FFF4EB',
  100: '#FFE4CC',
  200: '#FFC699',
  300: '#FFA35C',
  400: '#F98A33',
  500: '#EF6E0C',
  600: '#E65C00', // brand accent — exact hex, do not substitute Tailwind's default orange-600
  700: '#BA4A02',
  800: '#933C08',
  900: '#78330C',
}

// Cooler, denser neutral scale than Tailwind's default gray — carries the
// bulk of the UI's structure (surfaces, borders, body text) so the brand
// color reads as an accent instead of the dominant hue.
const ink = {
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
}

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand,
        ink,
        status: {
          // Attendance status codes (attendance_records.status CHECK)
          present: '#0E7A44',
          'present-bg': '#E1F5EA',
          absent: '#C22030',
          'absent-bg': '#FBE3E5',
          late: '#A6650A',
          'late-bg': '#FBEDD0',
          weekoff: '#5B6373',
          'weekoff-bg': '#EBEDF1',
          holiday: '#5B48B0',
          'holiday-bg': '#EBE4F8',
          halfday: '#A6540A',
          'halfday-bg': '#FBE7D0',
          // Approval / request states (leave_requests, advance_requests, ...)
          pending: '#A6650A',
          'pending-bg': '#FBEDD0',
          approved: '#0E7A44',
          'approved-bg': '#E1F5EA',
          rejected: '#C22030',
          'rejected-bg': '#FBE3E5',
        },
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '14px' }],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        // Subtle resting elevation for cards/surfaces.
        card: '0 1px 2px rgba(20,22,28,0.06), 0 1px 3px rgba(20,22,28,0.08)',
        // Raised elevation for modals, active/selected surfaces.
        elevated: '0 4px 10px rgba(20,22,28,0.10), 0 2px 4px rgba(20,22,28,0.06)',
      },
      minHeight: {
        touch: '44px', // WCAG/Material minimum touch target
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
}
