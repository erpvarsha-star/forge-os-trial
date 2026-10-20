/**
 * Edge function: payroll-feed-sync
 * POST { "month": 10, "year": 2026 }
 * → { inputs: PayrollInput[], reconciliation, warnings, blockedEmployees }
 *
 * READ-ONLY. Fetches raw rows from Supabase and calls the pure assembler in
 * lib/payroll/feedSync.ts. Requires PATCH_91 tables for canteen/society/
 * efficiency feeds; if they don't exist yet those feeds degrade to empty
 * (with a warning) so the function works pre-PATCH_91 too.
 *
 * Auth: caller must be management (is_management() RLS governs the reads).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { assemblePayrollInputs, FeedBundle } from '../../../lib/payroll/feedSync.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { month, year } = await req.json();
    if (!month || !year) throw new Error('month and year required');

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );

    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const start = `${year}-${mm}-01`, end = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
    const period = `${year}-${mm}`;

    const safe = async (q: PromiseLike<any>, label: string, warnings: string[]) => {
      const { data, error } = await q;
      if (error) { warnings.push(`${label}: ${error.message} (feed treated as empty)`); return []; }
      return data ?? [];
    };

    const feedWarnings: string[] = [];
    const [employees, salaries, attendance, leaves, advances, canteen, society, efficiency, statusEvents] = await Promise.all([
      sb.from('employees').select('id,emp_code,name,category,work_location,gender,is_active,weekly_off_day'),
      sb.from('employee_salary_structure').select('*').lte('effective_from', end),
      sb.from('attendance_records').select('employee_id,date,status,overtime_hours,check_in_time,check_out_time')
        .gte('date', start).lte('date', end),
      sb.from('leave_requests').select('employee_id,type,start_date,end_date,days,status')
        .eq('status', 'approved').lte('start_date', end).gte('end_date', start),
      sb.from('salary_advances').select('employee_id,monthly_deduction,outstanding_balance,status').eq('status', 'approved'),
      safe(sb.from('payroll_canteen_entries').select('employee_id,amount_inr,approval_status')
        .eq('payroll_month', period).eq('approval_status', 'approved'), 'canteen', feedWarnings),
      safe(sb.from('payroll_society_recoveries').select('employee_id,total_recovery_inr,approval_status')
        .eq('payroll_month', period).eq('approval_status', 'approved'), 'society', feedWarnings),
      safe(sb.from('payroll_efficiency_entries').select('employee_id,efficiency_pct,approval_status')
        .eq('payroll_month', period), 'efficiency', feedWarnings),
      safe(sb.from('employee_status_history').select('employee_id,status,effective_from'), 'status_history', feedWarnings),
    ]);
    if (employees.error) throw new Error('employees: ' + employees.error.message);
    if (salaries.error) throw new Error('salaries: ' + salaries.error.message);
    if (attendance.error) throw new Error('attendance: ' + attendance.error.message);

    const bundle: FeedBundle = {
      employees: employees.data ?? [], salaries: salaries.data ?? [],
      attendance: attendance.data ?? [], punches: [],
      leaves: leaves.data ?? [], advances: advances.data ?? [],
      canteen, society, efficiency, statusEvents,
    };
    const result = assemblePayrollInputs(year, month, bundle);
    result.warnings = [...feedWarnings, ...result.warnings];

    return new Response(JSON.stringify(result), { headers: { ...cors, 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }),
      { status: 400, headers: { ...cors, 'content-type': 'application/json' } });
  }
});
