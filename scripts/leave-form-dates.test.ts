/** Leave form date normalization tests — no DB. Run: npx tsx scripts/leave-form-dates.test.ts
 *
 * Root cause under test: Postgres DateStyle is ISO,MDY. A free-text
 * "YYYY-MM-DD" Start/End Date field let users type the natural DD/MM/YYYY
 * convention instead, which Postgres then silently misread as MM/DD/YYYY
 * whenever the day was <=12 (no error, wrong stored date), or threw a
 * generic "Something went wrong" when the day was >12. normalizeDateInput
 * must always read a slash date as DD/MM, never MM/DD.
 */
import { normalizeDateInput } from '../lib/leaveForm';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)); };

// Valid ISO passthrough
check('ISO passthrough 2026-11-23', normalizeDateInput('2026-11-23') === '2026-11-23');
check('ISO passthrough 2026-01-01', normalizeDateInput('2026-01-01') === '2026-01-01');

// Valid D/M/YYYY and DD/MM/YYYY conversions, including single-digit day/month
check('9/11/2026 -> 2026-11-09', normalizeDateInput('9/11/2026') === '2026-11-09');
check('09/11/2026 -> 2026-11-09', normalizeDateInput('09/11/2026') === '2026-11-09');
check('9/1/2026 -> 2026-01-09', normalizeDateInput('9/1/2026') === '2026-01-09');
check('1/9/2026 -> 2026-09-01', normalizeDateInput('1/9/2026') === '2026-09-01');
check('05/12/2026 -> 2026-12-05', normalizeDateInput('05/12/2026') === '2026-12-05');

// THE critical case: ambiguous-but-valid under both readings must resolve
// DD/MM, not MM/DD — this is the exact silent-corruption bug.
check(
  '09/11/2026 reads as DD/MM (9 Nov), NOT MM/DD (11 Sep) — the silent-corruption case',
  normalizeDateInput('09/11/2026') === '2026-11-09' && normalizeDateInput('09/11/2026') !== '2026-09-11'
);

// Day > 12: would have thrown "date/time field value out of range" under the
// old MM/DD assumption. Must now parse cleanly as DD/MM.
check('23/11/2026 -> 2026-11-23 (would crash under MM/DD)', normalizeDateInput('23/11/2026') === '2026-11-23');
check('31/10/2026 -> 2026-10-31 (would crash under MM/DD)', normalizeDateInput('31/10/2026') === '2026-10-31');

// 2-digit year variant seen live ("26/09/26") is NOT an accepted shape —
// only 4-digit years are accepted; must return null, never silently guess.
check('26/09/26 (2-digit year) -> null, not guessed', normalizeDateInput('26/09/26') === null);

// Actually-invalid dates -> null (not just a shape check — a real calendar check)
check('30/02/2026 (Feb 30) -> null', normalizeDateInput('30/02/2026') === null);
check('2026-02-30 (ISO Feb 30) -> null', normalizeDateInput('2026-02-30') === null);
check('15/13/2026 (month 13) -> null', normalizeDateInput('15/13/2026') === null);
check('2026-13-01 (ISO month 13) -> null', normalizeDateInput('2026-13-01') === null);
check('32/01/2026 (day 32) -> null', normalizeDateInput('32/01/2026') === null);

// Garbage / empty
check('garbage "abc" -> null', normalizeDateInput('abc') === null);
check('garbage "23-11-2026" (wrong separator) -> null', normalizeDateInput('23-11-2026') === null);
check('empty string -> null', normalizeDateInput('') === null);
check('whitespace-only -> null', normalizeDateInput('   ') === null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
