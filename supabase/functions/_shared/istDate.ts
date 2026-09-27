// IST (Indian Standard Time, UTC+5:30) date utilities for edge functions.
// Critical for Shift 3 (00:00-07:00 IST): at 01:00 IST, UTC is still the
// previous day, so a plain `new Date()` read via UTC getters is wrong.
//
// Touched 27 Sep 2026 solely to re-trigger Deploy Edge Functions after
// SUPABASE_ACCESS_TOKEN was rotated (new token valid to 25 Sep 2027) —
// confirms the CI deploy path works again, not a functional change.

export function istNow(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
}

export function istDateStr(): string {
  return istNow().toISOString().slice(0, 10);
}

export function istMonthYear(): { month: string; year: number } {
  const d = istNow();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return { month, year };
}

// Returns the UTC ISO timestamp for IST midnight of the given YYYY-MM-DD date.
// Needed whenever filtering a timestamptz column (e.g. created_at) by an IST
// calendar day — a bare "YYYY-MM-DDT00:00:00" is ambiguous/wrong without the
// +05:30 offset, since it would otherwise be read as UTC midnight, 5.5 hours
// before the actual IST day starts.
export function istStartOfDayUTC(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+05:30`).toISOString();
}
