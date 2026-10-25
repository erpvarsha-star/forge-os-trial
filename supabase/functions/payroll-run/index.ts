// Forge OS — Pay run runner (edge function).
// Actions (POST body.action):
//   create     { month, year, name? }          -> create draft pay_run (+ pay_period if missing)
//   generate_warnings { runId }                -> pre-check: compute + idempotently sync pay_run_warnings (draft only)
//   calculate  { payRunId, force? }            -> sync warnings, gate on pay_run_ready_to_calculate (422), then
//                                                 assemble feeds, run engine, write pay_run_items
//   transition { payRunId, to }                -> state-machine move (DB trigger enforces legality);
//                                                 to='finalized' first applies advance recoveries (PATCH_103)
//   create_topup { parentRunId }               -> supplementary draft run for employees held in a regular run
//   arrears_sep26_30 { payRunId }              -> one-time 26–30 Sep 2026 bridge line per employee
//   summary    { payRunId }                    -> totals + held + warnings
//   export     { payRunId }                    -> salary-sheet + bank-file rows (owner/hr_admin only)
//
// House rules: additive only; engine math is frozen (lib/payroll/engine.ts);
// every action writes audit_log; salary numbers never leave the DB.
//
// Schema notes (PATCH_89): pay_periods.month/year are TEXT ('10','2026');
// pay_run_items = { pay_run_id, employee_id, snapshot jsonb, net_pay };
// history runs are identified by status='archived' + pay_period month/year.
// Feed tables (PATCH_91) are keyed by payroll_month TEXT 'YYYY-MM'.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { assemblePayrollInputs } from './lib/feedSync.ts';
import { calculateOne, DEFAULT_ENGINE_CONFIG } from './lib/engine.ts';
import { PAY_RUN_TRANSITIONS } from './lib/payRunStateMachine.ts';
import { computeRunWarnings, countByType, diffWarnings } from './lib/warnings.ts';
import { notifyPayslipReady } from './lib/appNotify.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// ------------------------------------------------------------------ shared helpers
const safe = async (q: PromiseLike<any>) => { try { const r = await q; return r.data ?? []; } catch { return []; } };

/** Fetch every feed the engine + warnings need for one pay month (PATCH_91 tables degrade gracefully). */
async function loadFeeds(supabase: any, year: number, month: number) {
  const mm = String(month).padStart(2, '0');
  const payrollMonth = `${year}-${mm}`; // PATCH_91 feed key
  const periodEnd = `${year}-${mm}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const [employees, salaries, attendance, leaves, advances, canteen, society, efficiency, adjustments, statusEvents] =
    await Promise.all([
      safe(supabase.from('employees').select('id,emp_code,name,category,work_location,gender,is_active,weekly_off_day,pt_exempt')),
      safe(supabase.from('employee_salary_structure').select('*')),
      safe(supabase.from('attendance_records').select('employee_id,date,status,overtime_hours,check_in_time,check_out_time,late_minutes,late_reason')
        .gte('date', `${year}-${mm}-01`).lte('date', periodEnd)),
      safe(supabase.from('leave_requests').select('employee_id,type,start_date,end_date,days,status')),
      safe(supabase.from('advance_requests').select('employee_id,monthly_deduction,outstanding_balance,status')),
      safe(supabase.from('payroll_canteen_entries').select('employee_id,amount_inr,approval_status')
        .eq('payroll_month', payrollMonth)),
      safe(supabase.from('payroll_society_recoveries').select('employee_id,total_recovery_inr,approval_status')
        .eq('payroll_month', payrollMonth)),
      safe(supabase.from('payroll_efficiency_entries').select('employee_id,efficiency_pct,approval_status')
        .eq('payroll_month', payrollMonth)),
      safe(supabase.from('payroll_adjustments').select('employee_id,adjustment_type,signed_amount_inr,approval_status')
        .eq('payroll_month', payrollMonth)),
      safe(supabase.from('employee_status_history').select('employee_id,status,effective_from')),
    ]);
  return { mm, payrollMonth, periodEnd, employees, salaries, attendance, leaves, advances, canteen, society,
    efficiency, adjustments, statusEvents };
}

type Feeds = Awaited<ReturnType<typeof loadFeeds>>;

/** Assemble engine inputs; for a top-up run keep only employees with no item yet in the period. */
async function buildRunInputs(supabase: any, run: any, year: number, month: number, f: Feeds) {
  const assembled = assemblePayrollInputs(year, month, {
    employees: f.employees, salaries: f.salaries, attendance: f.attendance, punches: [], leaves: f.leaves,
    advances: f.advances,
    canteen: f.canteen.filter((c: any) => c.approval_status === 'approved'),
    society: f.society.filter((c: any) => c.approval_status === 'approved'),
    efficiency: f.efficiency, adjustments: f.adjustments, statusEvents: f.statusEvents,
  });
  const idByCode = new Map(f.employees.map((e: any) => [e.emp_code, e.id]));
  const topup = !!run.adjustment_of;
  let skippedAlreadyPaid = 0;
  let inputs = assembled.inputs;
  if (topup) {
    const { data: periodRuns } = await supabase
      .from('pay_runs').select('id').eq('pay_period_id', run.pay_period_id).neq('status', 'cancelled');
    const runIds = (periodRuns ?? []).map((r: any) => r.id);
    const paid = new Set<string>();
    if (runIds.length) {
      const { data: paidItems, error: pErr } = await supabase
        .from('pay_run_items').select('employee_id').in('pay_run_id', runIds);
      if (pErr) return { error: 'could not read existing items: ' + pErr.message } as const;
      for (const it of paidItems ?? []) paid.add(it.employee_id);
    }
    inputs = assembled.inputs.filter((i: any) => {
      const already = paid.has(idByCode.get(i.empCode) as string);
      if (already) skippedAlreadyPaid++;
      return !already;
    });
  }
  return { assembled, inputs, idByCode, topup, skippedAlreadyPaid } as const;
}

/**
 * Idempotent warning sync: insert missing rows, delete only still-pending rows that no longer apply,
 * never touch waived/deduct rows. Throws on DB error.
 */
async function syncRunWarnings(supabase: any, runId: string, f: Feeds, inputs: any[]) {
  const desired = computeRunWarnings({
    attendance: f.attendance, employees: f.employees,
    inputs: inputs.map((i: any) => ({ empCode: i.empCode, category: i.category, efficiencyPct: i.efficiencyPct })),
  });
  const { data: existing, error: eErr } = await supabase
    .from('pay_run_warnings').select('id, employee_code, warning_type, detail, decision').eq('run_id', runId);
  if (eErr) throw new Error('could not read warnings: ' + eErr.message);
  const { toInsert, toDeleteIds, toUpdate } = diffWarnings(existing ?? [], desired);
  if (toDeleteIds.length) {
    const { error } = await supabase.from('pay_run_warnings').delete().in('id', toDeleteIds).eq('decision', 'pending');
    if (error) throw new Error('warnings delete failed: ' + error.message);
  }
  for (const u of toUpdate) {
    const { error } = await supabase.from('pay_run_warnings').update({ detail: u.detail }).eq('id', u.id).eq('decision', 'pending');
    if (error) throw new Error('warnings update failed: ' + error.message);
  }
  if (toInsert.length) {
    const { error } = await supabase.from('pay_run_warnings').insert(
      toInsert.map((w) => ({ run_id: runId, employee_code: w.employee_code, warning_type: w.warning_type,
        detail: w.detail, decision: 'pending' })));
    if (error) throw new Error('warnings insert failed: ' + error.message);
  }
  return { inserted: toInsert.length, deleted: toDeleteIds.length, updated: toUpdate.length };
}

/** Current state of a run's warnings + the DB-side readiness verdict. */
async function warningStatus(supabase: any, runId: string) {
  const { data: rows, error } = await supabase
    .from('pay_run_warnings').select('warning_type, decision, agent_reviewed_at').eq('run_id', runId);
  if (error) throw new Error('could not read warnings: ' + error.message);
  const counts: Record<string, number> = {};
  let pendingCount = 0, unreviewedCount = 0;
  for (const r of rows ?? []) {
    counts[r.warning_type] = (counts[r.warning_type] ?? 0) + 1;
    if (r.decision === 'pending') pendingCount++;
    else if (!r.agent_reviewed_at) unreviewedCount++;
  }
  const { data: ready, error: rErr } = await supabase.rpc('pay_run_ready_to_calculate', { p_run_id: runId });
  if (rErr) throw new Error('readiness check failed: ' + rErr.message);
  return { warningsCount: (rows ?? []).length, counts, pendingCount, unreviewedCount, ready: ready === true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role: reads feeds, writes run items
  );

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { action } = body ?? {};

  // Caller auth: verify_jwt is ON at the gateway; this JWT -> employee -> role check is defence-in-depth.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { data: caller } = await supabase
    .from('employees').select('emp_code, role').eq('auth_user_id', user.id).single();
  // owner / hr_admin: every action; plant_head: summary only; everyone else refused.
  const allowed = caller && (caller.role === 'owner' || caller.role === 'hr_admin' ||
    (caller.role === 'plant_head' && action === 'summary'));
  if (!allowed) return json({ error: 'forbidden' }, 403);

  // audit_log: action restricted to insert/update/delete; detail in new_values
  const audit = async (payRunId: string | null, detail: Record<string, unknown>) =>
    supabase.from('audit_log').insert({
      table_name: 'pay_runs', row_id: payRunId ?? 'n/a', action: 'update',
      new_values: { ...detail, actor_emp_code: caller.emp_code },
    }).then(({ error }) => error && console.error('audit write failed', error.message));

  try {
    // ---------------------------------------------------------------- create
    if (action === 'create') {
      const month = Number(body.month), year = Number(body.year);
      if (!month || !year) return json({ error: 'month and year required' }, 400);
      const mm = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();

      const { data: period, error: pErr } = await supabase
        .from('pay_periods')
        .upsert({
          month: mm, year: String(year),
          start_date: `${year}-${mm}-01`,
          end_date: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
        }, { onConflict: 'month,year' })
        .select().single();
      if (pErr) return json({ error: pErr.message }, 500);

      const { data: run, error: rErr } = await supabase
        .from('pay_runs')
        .insert({
          pay_period_id: period.id,
          name: body.name ?? `${year}-${mm} regular`,
          status: 'draft',
        })
        .select().single();
      if (rErr) return json({ error: rErr.message }, 500);

      await audit(run.id, { event: 'create', month, year });
      return json({ payRunId: run.id, payPeriodId: period.id, status: 'draft' });
    }

    // ----------------------------------------------------------- create_topup
    // Supplementary run in the same pay period for employees HELD in a regular run; the
    // locked parent run is never touched. 'calculate' only pays people with no item yet.
    if (action === 'create_topup') {
      const { parentRunId } = body;
      const { data: parent } = await supabase
        .from('pay_runs').select('id, name, status, pay_period_id, adjustment_of').eq('id', parentRunId).single();
      if (!parent) return json({ error: 'parent pay run not found' }, 404);
      if (parent.adjustment_of) {
        return json({ error: 'parent must be a regular run (it is itself a top-up/adjustment)' }, 409);
      }
      if (!['finalized', 'payment_file_generated', 'paid', 'archived'].includes(parent.status)) {
        return json({ error: `parent run must be finalized or later (current: ${parent.status})` }, 409);
      }
      const { count } = await supabase
        .from('pay_runs').select('id', { count: 'exact', head: true }).eq('adjustment_of', parent.id);
      const n = (count ?? 0) + 1;
      const { data: top, error: tErr } = await supabase
        .from('pay_runs')
        .insert({ pay_period_id: parent.pay_period_id, adjustment_of: parent.id, name: `${parent.name} top-up ${n}`, status: 'draft' })
        .select().single();
      if (tErr) return json({ error: tErr.message }, 500);
      await audit(top.id, { event: 'create_topup', parentRunId: parent.id, n });
      return json({ payRunId: top.id, parentRunId: parent.id, status: 'draft' });
    }

    // ------------------------------------------------------------ transition
    if (action === 'transition') {
      const { payRunId, to } = body;
      const { data: run } = await supabase.from('pay_runs').select('status').eq('id', payRunId).single();
      if (!run) return json({ error: 'pay run not found' }, 404);
      const legal = (PAY_RUN_TRANSITIONS as Record<string, string[]>)[run.status] ?? [];
      if (!legal.includes(to)) {
        return json({ error: `illegal transition ${run.status} -> ${to}`, legalTargets: legal }, 409);
      }
      // Warnings gate #2: every pay_run_warnings row must be waived/deducted before review starts
      // (gate #1 is in 'calculate' via pay_run_ready_to_calculate, incl. the AI review).
      if (run.status === 'calculated' && to === 'in_review') {
        const { data: resolved, error: wErr } = await supabase.rpc('pay_run_warnings_resolved', { p_run_id: payRunId });
        if (wErr) return json({ error: 'could not read warnings: ' + wErr.message }, 500);
        if (resolved !== true) {
          const { count: pendingCount } = await supabase
            .from('pay_run_warnings').select('id', { count: 'exact', head: true })
            .eq('run_id', payRunId).eq('decision', 'pending');
          return json({
            error: 'warnings pending decision', pendingCount: pendingCount ?? 0,
            hint: 'Resolve the warnings (waive or deduct) on the Payroll Warnings screen first',
          }, 409);
        }
      }
      // PATCH_103: finalizing draws down advance balances. Idempotent per (run, advance), so a
      // retry after a failed status update is safe. If it errors the status is left unchanged.
      let advanceRecovery: unknown = undefined;
      if (to === 'finalized') {
        const { data: rec, error: recErr } = await supabase.rpc('apply_advance_recoveries', { p_run_id: payRunId });
        if (recErr) return json({ error: 'advance recovery failed (status unchanged): ' + recErr.message }, 500);
        advanceRecovery = rec;
      }
      const { error } = await supabase.from('pay_runs').update({ status: to }).eq('id', payRunId);
      if (error) return json({ error: error.message }, 500);
      // Best-effort payslip_ready notifications: never fails or rolls back the finalize.
      let notified: unknown = undefined;
      if (to === 'finalized') {
        try {
          const { data: pr } = await supabase
            .from('pay_runs').select('pay_periods(month, year)').eq('id', payRunId).single();
          notified = pr?.pay_periods
            ? await notifyPayslipReady(supabase, Deno.env.get('SUPABASE_URL')!, payRunId,
                Number(pr.pay_periods.month), Number(pr.pay_periods.year))
            : { inserted: 0, pushed: 0, error: 'pay period not found' };
        } catch (e) { notified = { inserted: 0, pushed: 0, error: String(e) }; }
      }
      const extra = { ...(advanceRecovery ? { advanceRecovery } : {}), ...(notified ? { notified } : {}) };
      await audit(payRunId, { event: 'transition', from: run.status, to, ...extra });
      return json({ ok: true, from: run.status, to, ...extra });
    }

    // ------------------------------------------------------ generate_warnings
    // Pre-check: compute warnings from the same inputs 'calculate' would use and sync the table
    // idempotently (decisions preserved). Writes no pay_run_items and changes no status.
    if (action === 'generate_warnings') {
      const { runId } = body;
      const { data: run } = await supabase
        .from('pay_runs').select('status, adjustment_of, pay_period_id, pay_periods(month, year)').eq('id', runId).single();
      if (!run) return json({ error: 'pay run not found' }, 404);
      if (run.status !== 'draft') return json({ error: `generate_warnings only from draft (current: ${run.status})` }, 409);
      const month = Number(run.pay_periods.month), year = Number(run.pay_periods.year);
      const f = await loadFeeds(supabase, year, month);
      const built = await buildRunInputs(supabase, run, year, month, f);
      if ('error' in built) return json({ error: built.error }, 500);
      const sync = await syncRunWarnings(supabase, runId, f, built.inputs);
      const st = await warningStatus(supabase, runId);
      await audit(runId, { event: 'generate_warnings', ...sync, warningsCount: st.warningsCount, pendingCount: st.pendingCount });
      return json({
        ok: true, warningsCount: st.warningsCount, counts: st.counts,
        pendingCount: st.pendingCount, unreviewedCount: st.unreviewedCount, ready: st.ready,
        inserted: sync.inserted, deleted: sync.deleted,
      });
    }

    // ------------------------------------------------------------ calculate
    if (action === 'calculate') {
      const { payRunId, force } = body;
      const { data: run } = await supabase
        .from('pay_runs').select('status, adjustment_of, pay_period_id, pay_periods(month, year)').eq('id', payRunId).single();
      if (!run) return json({ error: 'pay run not found' }, 404);
      if (run.status !== 'draft') {
        return json({ error: `calculate only from draft (current: ${run.status}). For a recalc, cancel and create a fresh run.` }, 409);
      }
      const month = Number(run.pay_periods.month);
      const year = Number(run.pay_periods.year);
      const f = await loadFeeds(supabase, year, month);
      const { mm, payrollMonth, employees, canteen, society, efficiency, adjustments } = f;

      // ---- feed-readiness gate: pending approvals block calculate unless forced
      const pendingFeeds = {
        canteen: canteen.filter((c: any) => c.approval_status !== 'approved').length,
        society: society.filter((c: any) => c.approval_status !== 'approved').length,
        efficiency: efficiency.filter((c: any) => c.approval_status !== 'approved').length,
        adjustments: adjustments.filter((c: any) => c.approval_status !== 'approved').length,
      };
      const pendingCount = pendingFeeds.canteen + pendingFeeds.society + pendingFeeds.efficiency + pendingFeeds.adjustments;
      if (pendingCount > 0 && !force) {
        return json({
          error: 'feeds pending approval', pendingFeeds,
          hint: 'approve the pending canteen/society/efficiency/adjustment entries, or call calculate with force:true',
        }, 422);
      }

      // ---- monthly VDA per-day rate gate (PATCH_103). Checked before any item is written.
      const { data: vdaRow } = await supabase
        .from('payroll_monthly_rates').select('vda_per_day_rate').eq('month', mm).eq('year', year).maybeSingle();
      const extraWarnings: string[] = [];
      let cfg = DEFAULT_ENGINE_CONFIG;
      if (vdaRow && Number(vdaRow.vda_per_day_rate) > 0) {
        cfg = { ...DEFAULT_ENGINE_CONFIG, workerVdaRatePerDay: Number(vdaRow.vda_per_day_rate) };
      } else if (!force) {
        return json({
          error: 'monthly VDA rate not entered',
          hint: "HR must enter this month's VDA per-day rate (Payroll Rates screen), or call calculate with force:true to use the default 103",
        }, 422);
      } else {
        extraWarnings.push(`No monthly VDA rate entered for ${payrollMonth}; using default ₹${DEFAULT_ENGINE_CONFIG.workerVdaRatePerDay}/day (forced)`);
      }

      const built = await buildRunInputs(supabase, run, year, month, f);
      if ('error' in built) return json({ error: built.error }, 500);
      const { assembled, inputs, idByCode, topup, skippedAlreadyPaid } = built;

      // ---- warnings gate (before ANY item is written): sync is idempotent and keeps decisions
      const runWarningsSync = await syncRunWarnings(supabase, payRunId, f, inputs);
      const wst = await warningStatus(supabase, payRunId);
      if (!wst.ready) {
        return json({
          error: 'warnings not ready', pendingCount: wst.pendingCount, unreviewedCount: wst.unreviewedCount,
          hint: 'Decide every warning (waive/deduct) and wait for the AI review before calculating',
        }, 422);
      }
      const warningCounts = wst.counts;

      // ---- run engine (still in draft — items are only written if the whole batch is sound)
      const items: any[] = [];
      const held: any[] = [];

      for (const input of inputs) {
        const result = calculateOne(input, cfg);
        if (result.held) { held.push({ empCode: input.empCode, blockers: result.blockers }); continue; }
        items.push({
          pay_run_id: payRunId,
          employee_id: idByCode.get(input.empCode),
          snapshot: {
            category: result.category, worked: result.worked,
            workingDays: input.workingDays,
            earnings: result.earnings, deductions: result.deductions,
            totalEarnings: result.totalEarnings, totalDeductions: result.totalDeductions,
            netPay: result.netPay, otPay: result.otPay,
            employer: result.employer, warnings: result.warnings,
            historical: false,
          },
          net_pay: result.netPay,
        });
      }
      if (items.length) {
        const { error: iErr } = await supabase.from('pay_run_items').insert(items);
        if (iErr) return json({ error: 'item insert failed (run still draft): ' + iErr.message }, 500);
      }

      // draft -> calculating -> calculated (two legal single steps per PATCH_89 trigger)
      await supabase.from('pay_runs').update({ status: 'calculating' }).eq('id', payRunId);
      const { error: tErr } = await supabase.from('pay_runs').update({ status: 'calculated' }).eq('id', payRunId);
      if (tErr) return json({ error: 'status transition failed after items written: ' + tErr.message }, 500);

      const warnings = [...extraWarnings, ...assembled.warnings];
      await audit(payRunId, {
        event: 'calculate', items: items.length, held: held.length,
        warnings: warnings.length, vdaRatePerDay: cfg.workerVdaRatePerDay,
        warningsCount: wst.warningsCount, warningCounts,
        ...(topup ? { topup: true, skippedAlreadyPaid } : {}),
      });
      return json({
        ok: true, calculated: items.length, held,
        warnings,
        warningsCount: wst.warningsCount, warningCounts,
        vdaRatePerDay: cfg.workerVdaRatePerDay,
        ...(topup ? {
          topup: true, skippedAlreadyPaid,
          ...(items.length === 0 ? { message: 'Nothing to pay: every eligible employee already has an item in this pay period (or is still held).' } : {}),
        } : {}),
        blockedEmployees: assembled.blockedEmployees,
        reconciliation: assembled.reconciliation,
      });
    }

    // --------------------------------------------------- arrears_sep26_30
    if (action === 'arrears_sep26_30') {
      const { payRunId } = body;
      const { data: run } = await supabase
        .from('pay_runs').select('status, adjustment_of, pay_periods(month, year)').eq('id', payRunId).single();
      if (!run) return json({ error: 'pay run not found' }, 404);
      if (run.adjustment_of) return json({ error: 'arrears helper is not available for top-up runs' }, 400);
      if (run.pay_periods.month !== '10' || run.pay_periods.year !== '2026') {
        return json({ error: 'arrears helper is only for October 2026' }, 400);
      }
      if (!['calculated', 'in_review'].includes(run.status)) {
        return json({ error: 'calculate the run first' }, 409);
      }
      // 26–30 Sep = 6 days of a 30-day month → bridge = 6/30 of September net,
      // read from the seeded history items (PATCH_90; archived runs).
      const { data: sepItems, error: sErr } = await supabase
        .from('pay_run_items')
        .select('employee_id, net_pay, pay_runs!inner(status, pay_periods!inner(month, year))')
        .eq('pay_runs.pay_periods.month', '09')
        .eq('pay_runs.pay_periods.year', '2026')
        .eq('pay_runs.status', 'archived');
      if (sErr) return json({ error: sErr.message }, 500);
      if (!sepItems?.length) {
        return json({ error: 'no September history found — apply PATCH_90 first' }, 404);
      }

      const { data: octItems } = await supabase
        .from('pay_run_items').select('id, employee_id').eq('pay_run_id', payRunId);
      const octByEmp = new Map((octItems ?? []).map((i: any) => [i.employee_id, i.id]));

      let written = 0;
      const skipped: string[] = [];
      for (const s of sepItems) {
        const octItemId = octByEmp.get(s.employee_id);
        if (!octItemId) { skipped.push(s.employee_id); continue; } // left before Oct
        const arrears = Math.round((s.net_pay * 6) / 30);
        const { error: uErr } = await supabase.rpc('attach_arrears_sep26_30', {
          p_item_id: octItemId, p_amount: arrears,
        });
        if (uErr) { skipped.push(`${s.employee_id}:${uErr.message}`); continue; }
        written++;
      }
      await audit(payRunId, { event: 'arrears_sep26_30', written, skipped: skipped.length });
      return json({ ok: true, written, skipped });
    }

    // --------------------------------------------------------------- summary
    if (action === 'summary') {
      const { payRunId } = body;
      const { data: items } = await supabase
        .from('pay_run_items').select('snapshot, net_pay').eq('pay_run_id', payRunId);
      const rows = items ?? [];
      const byCat: Record<string, { count: number; gross: number; net: number }> = {};
      for (const r of rows) {
        const cat = r.snapshot?.category ?? 'UNKNOWN';
        const b = (byCat[cat] ??= { count: 0, gross: 0, net: 0 });
        b.count++; b.gross += r.snapshot?.totalEarnings ?? 0; b.net += r.net_pay ?? 0;
      }
      return json({
        employees: rows.length,
        gross: rows.reduce((s: number, r: any) => s + (r.snapshot?.totalEarnings ?? 0), 0),
        net: rows.reduce((s: number, r: any) => s + (r.net_pay ?? 0), 0),
        arrearsSep2630: rows.reduce((s: number, r: any) => s + (r.snapshot?.arrears_sep26_30 ?? 0), 0),
        byCategory: byCat,
      });
    }

    // ---------------------------------------------------------------- export
    // Owner/hr_admin only (plant_head is allowed 'summary' alone, see gate above).
    // Bank details are returned to the caller only; never written to audit or logs.
    if (action === 'export') {
      const { payRunId } = body;
      const { data: run } = await supabase
        .from('pay_runs').select('status, name, pay_periods(month, year, end_date)').eq('id', payRunId).single();
      if (!run) return json({ error: 'pay run not found' }, 404);
      if (!['finalized', 'payment_file_generated', 'paid', 'archived'].includes(run.status)) {
        return json({ error: `export is available only for finalized runs (current: ${run.status})` }, 409);
      }
      const month = Number(run.pay_periods.month);
      const year = Number(run.pay_periods.year);
      const periodEnd = run.pay_periods.end_date
        ?? `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

      const { data: items, error: iErr } = await supabase
        .from('pay_run_items').select('employee_id, snapshot, net_pay').eq('pay_run_id', payRunId);
      if (iErr) return json({ error: iErr.message }, 500);
      const { data: emps } = await supabase.from('employees').select('id, emp_code, name');
      const empById = new Map((emps ?? []).map((e: any) => [e.id, e]));
      const { data: banks } = await supabase
        .from('employee_salary_structure')
        .select('employee_id, effective_from, bank_name, account_no, ifsc')
        .lte('effective_from', periodEnd);
      const bankByEmp = new Map<string, any>();
      for (const b of banks ?? []) {
        const cur = bankByEmp.get(b.employee_id);
        if (!cur || String(b.effective_from) > String(cur.effective_from)) bankByEmp.set(b.employee_id, b);
      }

      const salaryRows: any[] = [];
      const bankRows: any[] = [];
      for (const it of items ?? []) {
        const e: any = empById.get(it.employee_id);
        const snap: any = it.snapshot ?? {};
        const empCode = e?.emp_code ?? String(it.employee_id);
        const name = e?.name ?? '';
        const netPay = Number(it.net_pay ?? snap.netPay ?? 0);
        salaryRows.push({
          empCode, name, category: snap.category ?? null, worked: snap.worked ?? null,
          earnings: snap.earnings ?? {}, deductions: snap.deductions ?? {},
          totalEarnings: snap.totalEarnings ?? 0, totalDeductions: snap.totalDeductions ?? 0, netPay,
        });
        const b = bankByEmp.get(it.employee_id);
        bankRows.push({
          empCode, name, netPay,
          bankName: b?.bank_name ?? null, accountNo: b?.account_no ?? null, ifsc: b?.ifsc ?? null,
        });
      }
      await audit(payRunId, { event: 'export', items: salaryRows.length });
      return json({ month, year, runName: run.name, salaryRows, bankRows });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
