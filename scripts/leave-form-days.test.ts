/** Leave form day computation tests — no DB. Run: npx tsx scripts/leave-form-days.test.ts */
import { computeDays, hoursBetween, EXTRA_WORK_MAX } from '../lib/leaveForm';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)); };

// Equal-day halves
check('same day, no halves = 1', computeDays('2026-10-05', '2026-10-05') === 1);
check('same day, start_half set = 0.5', computeDays('2026-10-05', '2026-10-05', 'first') === 0.5);
check('same day, end_half set = 0.5', computeDays('2026-10-05', '2026-10-05', null, 'second') === 0.5);
check('same day, both halves = 0.5', computeDays('2026-10-05', '2026-10-05', 'second', 'first') === 0.5);

// First/second half combos across two days
check('2 days, start second half = 1.5', computeDays('2026-10-05', '2026-10-06', 'second') === 1.5);
check('2 days, end first half = 1.5', computeDays('2026-10-05', '2026-10-06', null, 'first') === 1.5);
check('2 days, start second + end first = 1', computeDays('2026-10-05', '2026-10-06', 'second', 'first') === 1);
check('2 days, start first + end second = 2', computeDays('2026-10-05', '2026-10-06', 'first', 'second') === 2);
check('2 days, no halves = 2', computeDays('2026-10-05', '2026-10-06') === 2);

// Multi-day
check('5 days inclusive = 5', computeDays('2026-10-01', '2026-10-05') === 5);
check('month boundary = 4', computeDays('2026-10-30', '2026-11-02') === 4);
check('5 days, start second = 4.5', computeDays('2026-10-01', '2026-10-05', 'second') === 4.5);
check('5 days, end first = 4.5', computeDays('2026-10-01', '2026-10-05', null, 'first') === 4.5);
check('5 days, both halves = 4', computeDays('2026-10-01', '2026-10-05', 'second', 'first') === 4);

// Minimum 0.5
check('min 0.5 (same-day second/first still 0.5)', computeDays('2026-10-05', '2026-10-05', 'second', 'first') === 0.5);
check('invalid range = 0', computeDays('2026-10-06', '2026-10-05') === 0);

// EXTRA_WORK_MAX
check('EXTRA_WORK_MAX = 5', EXTRA_WORK_MAX === 5);

// hoursBetween for extra-work blocks
check('09:00-13:00 = 4h', hoursBetween('09:00', '13:00') === 4);
check('18:00-22:30 = 4.5h', hoursBetween('18:00', '22:30') === 4.5);
check('reversed = 0', hoursBetween('13:00', '09:00') === 0);
check('garbage = 0', hoursBetween('xx', 'yy') === 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
