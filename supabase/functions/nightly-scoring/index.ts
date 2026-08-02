/**
 * nightly-scoring
 *
 * Implements Workflow 7 (Monthly Scoring Engine). Scheduled to run nightly
 * at 22:00 IST (Module 10, Module 3). For every active, scoreable employee
 * this recalculates the current month's composite score from five weighted
 * components, adds brownie points, ranks Employee-of-the-Month categories,
 * assigns a streak badge, and asks Claude for a one/two-sentence
 * personalised improvement tip.
 *
 * Role -> score-weight category mapping (Section 2 + Workflow 7 step 3):
 *   - role = 'member', department is a production dept -> "operator" weights
 *   - role = 'member', otherwise                        -> "member" weights
 *   - role = 'supervisor'                                -> "supervisor" weights
 *   - role = 'manager'                                   -> "manager" weights
 * Owner, Plant Head, HR Admin, Security Guard, and the AI agent are not
 * covered by the monthly composite score in the source document and are
 * skipped here.
 *
 * NOTE: per-employee KPI *actuals* aren't modeled as their own table yet
 * (only `role_kpis` target/weightage definitions exist) — kpi_score uses
 * task-completion rate as an interim proxy until a dedicated kpi_actuals
 * table and capture flow exist. Everything else is computed directly from
 * operational tables.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

const SCORE_WEIGHTS: Record<
  'member' | 'operator' | 'supervisor' | 'manager',
  { attendance: number; ontime: number; task: number; kpi: number; production: number; teamControl: number }
> = {
  member: { attendance: 30, ontime: 10, task: 20, kpi: 20, production: 20, teamControl: 0 },
  operator: { attendance: 20, ontime: 10, task: 10, kpi: 20, production: 30, teamControl: 10 },
  supervisor: { attendance: 25, ontime: 10, task: 25, kpi: 30, production: 0, teamControl: 10 },
  manager: { attendance: 20, ontime: 10, task: 25, kpi: 35, production: 0, teamControl: 10 },
};

const MAX_BROWNIE_POINTS = 10;

type ScoreCategory = keyof typeof SCORE_WEIGHTS;

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end, daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate() };
}

async function scoreCategoryFor(
  db: ReturnType<typeof supabaseAdmin>,
  employee: { role: string; department_id: string | null }
): Promise<ScoreCategory | null> {
  if (employee.role === 'supervisor') return 'supervisor';
  if (employee.role === 'manager') return 'manager';
  if (employee.role === 'member') {
    if (!employee.department_id) return 'member';
    const { data: dept } = await db.from('departments').select('is_production').eq('id', employee.department_id).single();
    return dept?.is_production ? 'operator' : 'member';
  }
  return null;
}

async function computeAttendanceAndOnTime(
  db: ReturnType<typeof supabaseAdmin>,
  employeeId: string,
  start: string,
  end: string
) {
  const { data: rows } = await db
    .from('attendance')
    .select('status, late_minutes')
    .eq('employee_id', employeeId)
    .gte('shift_date', start)
    .lte('shift_date', end);

  const all = rows ?? [];
  const workingDayRows = all.filter((r: { status: string }) => !['H', 'WO'].includes(r.status));
  const presentRows = workingDayRows.filter((r: { status: string }) => ['P', 'OT', 'LC'].includes(r.status));
  const onTimeRows = presentRows.filter((r: { late_minutes: number }) => (r.late_minutes ?? 0) === 0);

  const attendanceRatio = workingDayRows.length > 0 ? presentRows.length / workingDayRows.length : 0;
  const onTimeRatio = presentRows.length > 0 ? onTimeRows.length / presentRows.length : 0;
  const lcCount = presentRows.length - onTimeRows.length;

  return { attendanceRatio, onTimeRatio, lcCount, presentDays: presentRows.length };
}

async function computeTaskRatio(db: ReturnType<typeof supabaseAdmin>, employeeId: string, start: string, end: string) {
  const { data: rows } = await db
    .from('tasks')
    .select('status, points, due_date, completed_at')
    .eq('assigned_to', employeeId)
    .gte('due_date', start)
    .lte('due_date', end);

  const all = rows ?? [];
  if (all.length === 0) return { ratio: 1, onTimeAll: true, total: 0 }; // no tasks due = neutral full credit

  const totalPoints = all.reduce((s: number, t: { points: number }) => s + (t.points ?? 0), 0);
  const donePoints = all
    .filter((t: { status: string }) => t.status === 'done')
    .reduce((s: number, t: { points: number }) => s + (t.points ?? 0), 0);

  const onTimeAll = all.every(
    (t: { status: string; due_date: string; completed_at: string | null }) =>
      t.status === 'done' && t.completed_at !== null && t.completed_at.slice(0, 10) <= t.due_date
  );

  return { ratio: totalPoints > 0 ? donePoints / totalPoints : 1, onTimeAll, total: all.length };
}

async function computeProductionScore(db: ReturnType<typeof supabaseAdmin>, employeeId: string, start: string, end: string) {
  const { data: rows } = await db
    .from('hourly_production')
    .select('efficiency_pct')
    .eq('employee_id', employeeId)
    .gte('shift_date', start)
    .lte('shift_date', end)
    .not('efficiency_pct', 'is', null);

  const effs = (rows ?? []).map((r: { efficiency_pct: number }) => r.efficiency_pct);
  if (effs.length === 0) return { ratio: 0, avgEfficiency: null as number | null, incentiveFlag: false };

  const avg = effs.reduce((s: number, e: number) => s + e, 0) / effs.length;
  let ratio: number;
  if (avg >= 100) ratio = 1;
  else if (avg >= 90) ratio = 1;
  else if (avg >= 80) ratio = 0.8;
  else ratio = 0.5; // below 80% = alert band; partial credit, not zero

  return { ratio, avgEfficiency: avg, incentiveFlag: avg > 100 };
}

async function computeTeamControlScore(
  db: ReturnType<typeof supabaseAdmin>,
  employeeId: string,
  departmentId: string | null,
  start: string,
  end: string,
  workingDays: number
) {
  const { count: reportCount } = await db
    .from('shift_reports')
    .select('id', { count: 'exact', head: true })
    .eq('supervisor_id', employeeId)
    .gte('shift_date', start)
    .lte('shift_date', end);

  const reportRatio = workingDays > 0 ? Math.min(1, (reportCount ?? 0) / workingDays) : 0;

  const { count: flagCount } = await db
    .from('fraud_flags')
    .select('id', { count: 'exact', head: true })
    .eq('supervisor_id', employeeId)
    .gte('created_at', `${start}T00:00:00Z`)
    .lte('created_at', `${end}T23:59:59Z`);

  const penalty = Math.min(0.5, (flagCount ?? 0) * 0.15);
  return Math.max(0, reportRatio - penalty);
}

function computeBrownie(input: { lcCount: number; onTimeAll: boolean; taskTotal: number }): number {
  let points = 0;
  if (input.lcCount === 0) points += 4; // zero lates this month
  if (input.taskTotal > 0 && input.onTimeAll) points += 4; // all tasks completed on/before due date
  if (input.lcCount === 0 && input.taskTotal > 0 && input.onTimeAll) points += 2; // combined excellence bonus
  return Math.min(MAX_BROWNIE_POINTS, points);
}

async function computeAttendanceStreakBadge(db: ReturnType<typeof supabaseAdmin>, employeeId: string, asOf: string) {
  const { data: rows } = await db
    .from('attendance')
    .select('shift_date, status')
    .eq('employee_id', employeeId)
    .lte('shift_date', asOf)
    .order('shift_date', { ascending: false })
    .limit(120);

  let streak = 0;
  for (const row of rows ?? []) {
    if (['P', 'OT'].includes(row.status)) streak += 1;
    else if (['H', 'WO'].includes(row.status)) continue; // doesn't break streak
    else break;
  }

  if (streak >= 90) return { badge: 'gold_pending_top10pct', streak }; // top-10% check happens after ranking
  if (streak >= 60) return { badge: 'silver', streak };
  if (streak >= 30) return { badge: 'bronze', streak };
  return { badge: null, streak };
}

async function generateAiSuggestion(scoreSummary: Record<string, unknown>): Promise<string | null> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return null;

  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 120,
        messages: [
          {
            role: 'user',
            content:
              'You are writing a short, encouraging, specific improvement tip for a factory worker in India, ' +
              'based on this month\'s performance score data. Keep it to 1-2 short sentences, plain language, ' +
              'no jargon, second person ("you"). Score data (0-100 scale unless noted):\n' +
              JSON.stringify(scoreSummary),
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error('Claude API error', await res.text());
      return null;
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    return typeof text === 'string' ? text.trim() : null;
  } catch (err) {
    console.error('Claude API call failed', err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const db = supabaseAdmin();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const { start, end, daysInMonth } = monthRange(year, month);

  try {
    const { data: employees, error } = await db
      .from('employees')
      .select('id, role, department_id, full_name')
      .eq('is_active', true)
      .in('role', ['member', 'supervisor', 'manager']);

    if (error) return jsonResponse({ error: error.message }, 500);

    const scored: Array<{ employeeId: string; category: ScoreCategory; compositeScore: number }> = [];

    for (const employee of employees ?? []) {
      const category = await scoreCategoryFor(db, employee);
      if (!category) continue;

      const weights = SCORE_WEIGHTS[category];
      const { attendanceRatio, onTimeRatio, lcCount, presentDays } = await computeAttendanceAndOnTime(db, employee.id, start, end);
      const { ratio: taskRatio, onTimeAll, total: taskTotal } = await computeTaskRatio(db, employee.id, start, end);
      const { ratio: productionRatio, avgEfficiency, incentiveFlag } = await computeProductionScore(db, employee.id, start, end);
      const teamControlRatio =
        weights.teamControl > 0
          ? await computeTeamControlScore(db, employee.id, employee.department_id, start, end, presentDays || daysInMonth)
          : 0;

      // Interim KPI proxy — see module docstring.
      const kpiRatio = taskRatio;

      const attendanceScore = attendanceRatio * weights.attendance;
      const ontimeScore = onTimeRatio * weights.ontime;
      const taskScore = taskRatio * weights.task;
      const kpiScore = kpiRatio * weights.kpi;
      const productionScore = productionRatio * weights.production;
      const teamControlScore = teamControlRatio * weights.teamControl;

      const brownie = computeBrownie({ lcCount, onTimeAll, taskTotal });
      const composite = attendanceScore + ontimeScore + taskScore + kpiScore + productionScore + teamControlScore + brownie;

      const { badge, streak } = await computeAttendanceStreakBadge(db, employee.id, end);

      const aiSuggestion = await generateAiSuggestion({
        employee: employee.full_name,
        category,
        attendanceScore: Math.round(attendanceScore),
        ontimeScore: Math.round(ontimeScore),
        taskScore: Math.round(taskScore),
        kpiScore: Math.round(kpiScore),
        productionScore: Math.round(productionScore),
        teamControlScore: Math.round(teamControlScore),
        brownie,
        compositeScore: Math.round(composite),
        avgEfficiency,
        attendanceStreakDays: streak,
      });

      await db.from('monthly_scores').upsert(
        {
          employee_id: employee.id,
          year,
          month,
          attendance_score: round2(attendanceScore),
          ontime_score: round2(ontimeScore),
          task_score: round2(taskScore),
          kpi_score: round2(kpiScore),
          production_score: round2(productionScore),
          team_control_score: round2(teamControlScore),
          brownie_points: brownie,
          composite_score: round2(composite),
          badge,
          ai_suggestion: aiSuggestion,
          ai_suggestion_generated_at: aiSuggestion ? new Date().toISOString() : null,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'employee_id,year,month' }
      );

      if (incentiveFlag) {
        await db.from('notifications').insert({
          employee_id: employee.id,
          type: 'production_incentive_flag',
          title: 'Incentive flag',
          body: `Your production efficiency this period is above 100% — flagged for incentive review.`,
        });
      }

      scored.push({ employeeId: employee.id, category, compositeScore: composite });
    }

    // Employee-of-the-Month ranking, per category (Section 2/Module 3).
    const categories: ScoreCategory[] = ['member', 'operator', 'supervisor', 'manager'];
    for (const category of categories) {
      const group = scored.filter((s) => s.category === category).sort((a, b) => b.compositeScore - a.compositeScore);
      const leaderScore = group[0]?.compositeScore ?? 0;
      const eotmCategory = `best_${category}`;

      for (let i = 0; i < group.length; i++) {
        const rank = i + 1;
        const gap = round2(leaderScore - group[i].compositeScore);
        await db
          .from('monthly_scores')
          .update({
            eotm_category: eotmCategory,
            eotm_rank: rank,
            eotm_gap_to_leader: gap,
            eotm_winner: rank === 1,
            badge: rank === 1 ? 'eotm_winner' : undefined,
          })
          .eq('employee_id', group[i].employeeId)
          .eq('year', year)
          .eq('month', month);
      }
    }

    return jsonResponse({ year, month, employeesScored: scored.length });
  } catch (err) {
    console.error('nightly-scoring failed', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
