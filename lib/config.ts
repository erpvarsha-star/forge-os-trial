export const APP_CONFIG = {
  appName: process.env.EXPO_PUBLIC_APP_NAME || 'Forge OS',
  companyName: process.env.EXPO_PUBLIC_COMPANY_NAME || 'Your Company',
  primaryColor: process.env.EXPO_PUBLIC_PRIMARY_COLOR || '#E65C00',
  logoUrl: process.env.EXPO_PUBLIC_LOGO_URL || '',
  supportPhone: process.env.EXPO_PUBLIC_SUPPORT_PHONE || '',
}

// Plant identity and payroll constants — used by lib/payslip.ts. Kept
// separate from APP_CONFIG (which is purely white-label branding) since
// these are Varsha Forgings' actual statutory figures, not per-tenant config.
export const PLANT = {
  name: APP_CONFIG.companyName,
  location: 'B7, M.I.D.C, Waluj, Aurangabad, Maharashtra',
}

export const PAYROLL = {
  pfRatePct: 12,
  esicRatePct: 0.75,
  esicGrossCeiling: 21000,
  ptAmount: 200,
  mlwfAmount: 25,
}
