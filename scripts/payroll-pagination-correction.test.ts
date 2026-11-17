/**
 * PATCH_138 — pagination helper + delta-only correction run, pure unit tests.
 * No DB, no Deno: exercises the three pure modules supabase/functions/payroll-run/index.ts's
 * loadFeeds()/buildRunInputs()/calculate now use:
 *   lib/payroll/pagedFetch.ts     — generic .range() paging loop
 *   lib/payroll/topupFilter.ts    — plain top-up vs delta-only input filtering
 *   lib/payroll/deltaCorrection.ts — per-employee shortfall-only net_pay math
 * Run: npx tsx scripts/payroll-pagination-correction.test.ts
 */
import { fetchAllPages } from '../lib/payroll/pagedFetch';
import { filterTopupInputs } from '../lib/payroll/topupFilter';
import { resolveDeltaCorrection } from '../lib/payroll/deltaCorrection';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)); };

// ============================================================ fetchAllPages
console.log('== fetchAllPages: generic .range() paging ==');

async function run() {
  // (a) pages past 1000 rows correctly: a fake 2,731-row table (October 2026's real count),
  // the exact shape of the bug this patch fixes — PostgREST would have silently truncated a
  // single-shot select on this at ~1000 rows.
  {
    const TOTAL = 2731;
    const calls: { offset: number; limit: number }[] = [];
    const page = async (offset: number, limit: number) => {
      calls.push({ offset, limit });
      const n = Math.max(0, Math.min(limit, TOTAL - offset));
      return Array.from({ length: n }, (_, i) => offset + i); // row "id" = its index
    };
    const rows = await fetchAllPages(page, 1000);
    check('2731-row table: all rows returned, in order', rows.length === TOTAL && rows[0] === 0 && rows[TOTAL - 1] === TOTAL - 1,
      `got ${rows.length} rows`);
    check('2731-row table: exactly 3 pages fetched (1000+1000+731)', calls.length === 3, `got ${calls.length} calls: ${JSON.stringify(calls)}`);
    check('2731-row table: offsets are 0,1000,2000', calls.map((c) => c.offset).join(',') === '0,1000,2000');
    check('2731-row table: last page shorter than pageSize (the stop signal)', calls[2].limit === 1000 && rows.length - 2000 === 731);
  }

  // Exact-multiple-of-pageSize case: PostgREST gives no other way to know the table ended,
  // so one more (empty) page fetch is expected and correct, not a bug.
  {
    const TOTAL = 2000;
    let calls = 0;
    const page = async (offset: number, limit: number) => {
      calls++;
      const n = Math.max(0, Math.min(limit, TOTAL - offset));
      return Array.from({ length: n }, () => 1);
    };
    const rows = await fetchAllPages(page, 1000);
    check('exact multiple of pageSize (2000 @ 1000): all rows returned', rows.length === 2000, `got ${rows.length}`);
    check('exact multiple of pageSize: 3 calls (1000+1000+0, the trailing empty page proves the loop stopped correctly)', calls === 3, `got ${calls}`);
  }

  // Empty table.
  {
    const rows = await fetchAllPages(async () => [], 1000);
    check('empty table: one call, zero rows', rows.length === 0);
  }

  // Single short page (today's attendance_records-per-small-table shape, e.g. leave_requests: 32 rows).
  {
    let calls = 0;
    const rows = await fetchAllPages(async (offset) => { calls++; return offset === 0 ? Array.from({ length: 32 }, () => 'x') : []; }, 1000);
    check('32-row table: all returned in a single call', rows.length === 32 && calls === 1, `got ${rows.length} rows, ${calls} calls`);
  }

  // A smaller custom pageSize still pages correctly (the production call uses 1000, but the
  // helper itself must not hardcode that).
  {
    const TOTAL = 25;
    const rows = await fetchAllPages(async (offset, limit) => {
      const n = Math.max(0, Math.min(limit, TOTAL - offset));
      return Array.from({ length: n }, (_, i) => offset + i);
    }, 10);
    check('custom pageSize=10 over 25 rows: all 25 returned', rows.length === 25 && rows[24] === 24, `got ${rows.length}`);
  }

  // Runaway fetchPage (e.g. a bug that ignores offset and always returns a full page) must not
  // hang the edge function forever — it throws instead.
  {
    let threw = false;
    try {
      await fetchAllPages(async (_offset, limit) => Array.from({ length: limit }, () => 1), 1000);
    } catch (e) {
      threw = true;
      check('runaway fetchPage throws a descriptive error', String(e).includes('exceeded') && String(e).includes('pages'), String(e));
    }
    check('runaway fetchPage does not loop forever (throws)', threw);
  }

  // ====================================================== filterTopupInputs
  console.log('== filterTopupInputs: plain top-up vs delta-only ==');
  const inputs = [{ empCode: 'A' }, { empCode: 'B' }, { empCode: 'C' }];
  const keyOf = (i: { empCode: string }) => ({ A: 'id-a', B: 'id-b', C: 'id-c' }[i.empCode]);
  const paid = new Set(['id-a', 'id-b']); // A and B already paid in a prior run; C was missed

  {
    // (d) PLAIN TOP-UP (deltaOnly=false) — must behave exactly as before this patch:
    // already-paid employees are dropped entirely, only the missed one remains.
    const { kept, skippedAlreadyPaid } = filterTopupInputs(inputs, keyOf as any, paid, false);
    check('plain top-up: only the missed employee (C) is kept', kept.length === 1 && kept[0].empCode === 'C', JSON.stringify(kept));
    check('plain top-up: 2 already-paid employees counted as skipped', skippedAlreadyPaid === 2, `got ${skippedAlreadyPaid}`);
  }
  {
    // No-op regression: nobody paid yet -> plain top-up keeps everyone, skips nobody.
    const { kept, skippedAlreadyPaid } = filterTopupInputs(inputs, keyOf as any, new Set(), false);
    check('plain top-up, nobody paid yet: everyone kept', kept.length === 3);
    check('plain top-up, nobody paid yet: 0 skipped', skippedAlreadyPaid === 0);
  }
  {
    // (b)/(c) DELTA-ONLY: nobody is filtered out — the correction math (tested below) decides
    // per-employee whether to write a full amount, a shortfall, or nothing.
    const { kept, skippedAlreadyPaid } = filterTopupInputs(inputs, keyOf as any, paid, true);
    check('delta-only: all 3 employees kept (none filtered out)', kept.length === 3, JSON.stringify(kept));
    check('delta-only: skippedAlreadyPaid is always 0 (filtering happens downstream instead)', skippedAlreadyPaid === 0);
  }

  // ==================================================== resolveDeltaCorrection
  console.log('== resolveDeltaCorrection: per-employee shortfall-only math ==');
  const PARENT = 'parent-run-id';

  {
    // (b) Missed entirely in the parent run (alreadyPaid=0) -> paid in full, like a plain top-up.
    const r = resolveDeltaCorrection(PARENT, 28400, 0);
    check('missed entirely: write=true', r.write === true);
    check('missed entirely: netPay = full correct total', r.netPay === 28400, `got ${r.netPay}`);
    check('missed entirely: no correctionOf (not a correction, a fresh payment)', r.correctionOf === null);
  }
  {
    // (b) Underpaid in the parent run -> write only the positive difference, with full audit trail.
    const r = resolveDeltaCorrection(PARENT, 28400, 6400); // the real VFL1064-shaped Oct underpay
    check('underpaid: write=true', r.write === true);
    check('underpaid: netPay = correctTotal - alreadyPaid only', r.netPay === 22000, `got ${r.netPay}`);
    check('underpaid: correctionOf carries the full audit trail', JSON.stringify(r.correctionOf) ===
      JSON.stringify({ parentRunId: PARENT, alreadyPaid: 6400, correctTotal: 28400, delta: 22000 }), JSON.stringify(r.correctionOf));
  }
  {
    // (c) Correctly paid already (delta === 0) -> NO item written in the correction run.
    const r = resolveDeltaCorrection(PARENT, 28400, 28400);
    check('correctly paid, delta=0: write=false (no item written)', r.write === false);
    check('correctly paid, delta=0: no correctionOf', r.correctionOf === null);
  }
  {
    // (c) Overpaid in the parent run (delta negative) -> also NO item, never a negative net_pay.
    const r = resolveDeltaCorrection(PARENT, 10000, 15000);
    check('overpaid, delta<0: write=false (never write a negative net_pay)', r.write === false);
    check('overpaid, delta<0: no correctionOf', r.correctionOf === null);
  }
  {
    // Rounding: delta is rounded to 2 decimal places, matching every other money figure in this engine.
    const r = resolveDeltaCorrection(PARENT, 1000.005, 500.002);
    check('rounding: delta rounded to 2dp', r.netPay === 500, `got ${r.netPay}`); // 500.003 -> 500.00
  }
  {
    // Multiple prior runs: alreadyPaid is the SUM across every non-cancelled run of the period —
    // exercised at the filterTopupInputs/buildRunInputs layer (summed there), this just confirms
    // resolveDeltaCorrection treats whatever sum it's given correctly.
    const sumOfTwoPriorRuns = 4000 + 2400; // e.g. original run paid 4000, an earlier top-up paid 2400
    const r = resolveDeltaCorrection(PARENT, 10000, sumOfTwoPriorRuns);
    check('sum of multiple prior runs used correctly', r.netPay === 3600, `got ${r.netPay}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

run();
