/** lateMinutesAgainst() 720-minute boundary — no DB. Run: npx tsx scripts/late-minutes-boundary.test.ts
 *
 * Root cause under test: the function's own comment says "More than 12h
 * 'late' means the check-in is actually early for that start" — i.e. the
 * cap should trigger AT 720 minutes, not only above it. A check-in exactly
 * 12h00m after shift start must read 0 (early), not 720 (late). Fixed
 * 21 Nov 2026 (`diff > 720` -> `diff >= 720`) in lib/istDate.ts and the
 * hand-synced lib/serverClock.ts copy (serverLateMinutesAgainst) — same
 * formula, not imported here because it pulls in lib/supabase.ts, which
 * throws without live Supabase env vars in a plain node run.
 */
import { lateMinutesAgainst } from '../lib/istDate';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)); };

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Freezes Date.now() so we can place "now" at an exact offset from a given
// shift start, in IST minutes, and read lateMinutesAgainst's result.
function lateMinutesAtOffset(startTime: string, offsetMinutes: number): number {
  const [h, m] = startTime.split(':').map(Number);
  // Pick an arbitrary IST calendar day, anchor shift start within it (UTC ms
  // equivalent of that IST clock reading), then add the offset.
  const istMidnightUtcMs = Date.UTC(2026, 10, 21, 0, 0, 0) - IST_OFFSET_MS;
  const shiftStartMs = istMidnightUtcMs + (h * 60 + m) * 60 * 1000;
  const nowMs = shiftStartMs + offsetMinutes * 60 * 1000;
  const realNow = Date.now;
  Date.now = () => nowMs;
  try {
    return lateMinutesAgainst(startTime);
  } finally {
    Date.now = realNow;
  }
}

// Boundary itself: exactly 720 minutes after start must be 0 (early-cap),
// not 720 (late) — this is the off-by-one the fix closes.
check('diff === 720 caps to 0 (early), not 720 (late)', lateMinutesAtOffset('07:00', 720) === 0);

// One minute either side of the boundary, to pin the edge precisely.
check('diff === 719 still reads late (719)', lateMinutesAtOffset('07:00', 719) === 719);
check('diff === 721 still caps to 0', lateMinutesAtOffset('07:00', 721) === 0);

// Ordinary cases, unaffected by the fix.
check('on time (diff 0) -> 0', lateMinutesAtOffset('07:00', 0) === 0);
check('15 min late -> 15', lateMinutesAtOffset('07:00', 15) === 15);

// Midnight wraparound (Shift 3, 00:00 start): arriving 10 min before wraps
// to diff=1430 under the modulo arithmetic, which is >=720 and therefore
// correctly early-capped to 0 — confirms the fix didn't disturb wraparound.
check('wraparound: 10 min before 00:00 start -> 0 (early-capped)', lateMinutesAtOffset('00:00', -10) === 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
