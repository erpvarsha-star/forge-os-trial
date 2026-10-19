// Forge OS — Pay run runner (edge function).
// Actions (POST body.action):
//   create     { month, year, name? }          -> create draft pay_run (+ pay_period if missing)
//   calculate  { payRunId, force? }            -> assemble feeds, run engine, write pay_run_items
//   transition { payRunId, to }                -> state-machine move (DB trigger enforces legality)
//   arrears_sep26_30 { payRunId }              -> one-time 26–30 Sep 2026 bridge line per employee
//   summary    { payRunId }                    -> totals + held + warnings
//
// House rules: additive only; engine math is frozen (lib/payroll/engine.ts);
// every action writes audit_log; salary numbers never leave the DB.
//
// Schema notes (PATCH_89): pay_periods.month/year are TEXT ('10','2026');
// pay_run_items = { pay_run_id, employee_id, snapshot jsonb, net_pay };
// history runs are identified by status='archived' + pay_period month/year.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { assemblePayrollInputs } from '../../../lib/payroll/feedSync.ts';
import { calculateOne } from '../../../lib/payroll/engine.ts';
import { PAY_RUN_TRANSITIONS } from '../../../lib/payroll/payRunStateMachine.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role: reads feeds, writes run items
  );

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { action } = body ?? {};

  // audit_log: action restricted to insert/update/delete; detail in new_values
  const audit = async (payRunId: string | null, detail: Record<string, unknown>) =>
    supabase.from('audit_log').insert({
      table_name: 'pay_runs', row_id: payRunId ?? 'n/a', action: 'update',
      new_values: detail,
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

    // ------------------------------------------------------------ transition
    if (action === 'transition') {
      const { payRunId, to } = body;
      const { data: run } = await supabase.from('pay_runs').select('status').eq('id', payRunId).single();
      if (!run) return json({ error: 'pay run not found' }, 404);
      const legal = (PAY_RUN_TRANSITIONS as Record<string, string[]>)[run.status] ?? [];
      if (!legal.includes(to)) {
        return json({ error: `illegal transition ${run.status} -> ${to}`, legalTargets: legal }, 409);
      }
      const { error } = await supabase.from('pay_runs').update({ status: to }).eq('id', payRunId);
      if (error) return json({ error: error.message }, 500);
      await audit(payRunId, { event: 'transition', from: run.status, to });
      return json({ ok: true, from: run.status, to });
    }

    // ------------------------------------------------------------ calculate
    if (action === 'calculate') {
      const { payRunId, force } = body;
      const { data: run } = await supabase
        .from('pay_runs').select('status, pay_periods(month, year)').eq('id', payRunId).single();
      if (!run) return json({ error: 'pay run not found' }, 404);
      if (run.status !== 'draft') {
        return json({ error: `calculate only from draft (current: ${run.status}). For a recalc, cancel and create a fresh run.` }, 409);
      }
      const month = Number(run.pay_periods.month);
      const year = Number(run.pay_periods.year);
      const mm = String(month).padStart(2, '0');
      const periodEnd = `${year}-${mm}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

      // ---- fetch feeds (PATCH_91 tables degrade gracefully if not yet applied)
      const safe = async (q: PromiseLike<any>) => { try { const r = await q; return r.data ?? []; } catch { return []; } };
      const [employees, salaries, attendance, leaves, advances, canteen, society, efficiency, statusEvents] =
        await Promise.all([
          safe(supabase.from('employees').select('id,emp_code,name,category,work_location,gender,is_active,weekly_off_day')),
          safe(supabase.from('employee_salary_structure').select('*')),
          safe(supabase.from('attendance_records').select('employee_id,date,status,overtime_hours,check_in_time,check_out_time')
            .gte('date', `${year}-${mm}-01`).lte('date', periodEnd)),
          safe(supabase.from('leave_requests').select('employee_id,type,start_date,end_date,days,status')),
          safe(supabase.from('salary_advances').select('employee_id,monthly_deduction,outstanding_balance,status')),
          safe(supabase.from('payroll_canteen_entries').select('employee_id,amount_inr,approval_status')
            .eq('month', month).eq('year', year)),
          safe(supabase.from('payroll_society_recoveries').select('employee_id,total_recovery_inr,approval_status')
            .eq('month', month).eq('year', year)),
          safe(supabase.from('payroll_efficiency_entries').select('employee_id,efficiency_pct,approval_status')
            .eq('month', month).eq('year', year)),
          safe(supabase.from('employee_status_history').select('employee_id,status,effective_from')),
        ]);

      // ---- feed-readiness gate: pending approvals block calculate unless forced
      const pendingFeeds = {
        canteen: canteen.filter((c: any) => c.approval_status !== 'approved').length,
        society: society.filter((c: any) => c.approval_status !== 'approved').length,
        efficiency: efficiency.filter((c: any) => c.approval_status !== 'approved').length,
      };
      const pendingCount = pendingFeeds.canteen + pendingFeeds.society + pendingFeeds.efficiency;
      if (pendingCount > 0 && !force) {
        return json({
          error: 'feeds pending approval', pendingFeeds,
          hint: 'approve the pending canteen/society/efficiency entries, or call calculate with force:true',
        }, 422);
      }

      const assembled = assemblePayrollInputs(year, month, {
        employees, salaries, attendance, punches: [], leaves, advances,
        canteen: canteen.filter((c: any) => c.approval_status === 'approved'),
        society: society.filter((c: any) => c.approval_status === 'approved'),
        efficiency, statusEvents,
      });

      // ---- run engine (still in draft — items are only written if the whole batch is sound)
      const idByCode = new Map(employees.map((e: any) => [e.emp_code, e.id]));
      const items: any[] = [];
      const held: any[] = [];
      for (const input of assembled.inputs) {
        const result = calculateOne(input);
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

      await audit(payRunId, {
        event: 'calculate', items: items.length, held: held.length,
        warnings: assembled.warnings.length,
      });
      return json({
        ok: true, calculated: items.length, held,
        warnings: assembled.warnings,
        blockedEmployees: assembled.blockedEmployees,
        reconciliation: assembled.reconciliation,
      });
    }

    // --------------------------------------------------- arrears_sep26_30
    if (action === 'arrears_sep26_30') {
      const { payRunId } = body;
      const { data: run } = await supabase
        .from('pay_runs').select('status, pay_periods(month, year)').eq('id', payRunId).single();
      if (!run) return json({ error: 'pay run not found' }, 404);
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

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
