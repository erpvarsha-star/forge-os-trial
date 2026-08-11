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
 * ---------------------------------------------------------------------------
 * REWRITTEN 11 Aug 2026 — this function previously queried three tables that
 * do not exist in the deployed schema (`tasks`, `hourly_production`,
 * `shift_reports`). Supabase returns an error rather than throwing, the code
 * defaulted each to an empty array, and the result was that roughly half of
 * every composite score was silently computed as zero for all 129 employees.
 *
 * Each component now reads a table that actually exists:
 *   task        <- maintenance_observations (what supervisor/tasks.tsx treats
 *                  as the task list already)
 *   teamControl <- data_collection_submissions (FINAL_SCHEMA labels this
 *                  "(shift reports)"; it carries supervisor_id + date, so the
 *                  swap is 1:1 with the old shift_reports query)
 *   kpi         <- mrm_reviews for supervisor/manager (department-level, the
 *                  only real KPI actuals captured anywhere), falling back to
 *                  the task ratio for members, who have no MRM row
 *   production  <- REMOVED. No per-employee production data is captured
 *                  anywhere in the system, so this could never be anything but
 *                  zero. Its weight is redistributed across attendance/ontime/
 *                  task rather than left as dead weight that silently caps
 *                  everyone's achievable score. `production_score` is still
 *                  written as 0 so worker/score.tsx and types/index.ts keep
 *                  working untouched.
 *
 * Also now persists `five_s_score` and `safety_score`. owner/eotm.tsx ranks
 * two of its four Employee-of-the-Month categories on those columns, but
 * nothing had ever written them — every row sat at the default 0, so those two
 * winners were whichever row happened to sort first. They are real values now.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

// Every row must total 100 before brownie points; asserted at boot below.
const SCORE_WEIGHTS: Record<
  'member' | 'operator' | 'supervisor' | 'manager',
  { attendance: number; ontime: number; task: number; kpi: number; teamControl: number }
> = {
  member: { attendance: 40, ontime: 15, task: 25, kpi: 20, teamControl: 0 },
  operator: { attendance: 35, ontime: 15, task: 20, kpi: 20, teamControl: 10 },
  supervisor: { attendance: 25, ontime: 10, task: 25, kpi: 30, teamControl: 10 },
  manager: { attendance: 20, ontime: 10, task: 25, kpi: 35, teamControl: 10 },
};

// A mis-summed weight row silently rescales everyone in that category, which
// is invisible in the output — fail loudly at module load instead.
for (const [category, w] of Object.entries(SCORE_WEIGHTS)) {
  const total = w.attendance + w.ontime + w.task + w.kpi + w.teamControl;
  if (total !== 100) {
    throw new Error(`SCORE_WEIGHTS.${category} sums to ${total}, expected 100`);
  }
}

const MAX_BROWNIE_POINTS = 10;

type ScoreCategory = keyof typeof SCORE_WEIGHTS;

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end, daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate() };
}

async function scoreCategoryFor(
  db: ReturnType<typeof supabaseAdmin>,
  employee: { role: string; department: string | null }
): Promise<ScoreCategory | null> {
  if (employee.role === 'supervisor') return 'supervisor';
  if (employee.role === 'manager') return 'manager';
  if (employee.role === 'member') {
    if (!employee.department) return 'member';
    const { data: dept } = await db.from('departments').select('is_production').eq('name', employee.department).single();
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
    .from('attendance_records')
    .select('status, late_minutes')
    .eq('employee_id', employeeId)
    .gte('date', start)
    .lte('date', end);

  const all = rows ?? [];
  const workingDayRows = all.filter((r: { status: string }) => !['H', 'WO'].includes(r.status));
  // 'P' and 'HL' are the only present-at-work statuses. The previous version
  // also matched 'OT' and 'LC', which the attendance_records.status CHECK
  // constraint forbids — they could never appear, so those were dead branches.
  const presentRows = workingDayRows.filter((r: { status: string }) => ['P', 'HL'].includes(r.status));
  const onTimeRows = presentRows.filter((r: { late_minutes: number }) => (r.late_minutes ?? 0) === 0);

  const attendanceRatio = workingDayRows.length > 0 ? presentRows.length / workingDayRows.length : 0;
  const onTimeRatio = presentRows.length > 0 ? onTimeRows.length / presentRows.length : 0;
  const lcCount = presentRows.length - onTimeRows.length;

  return { attendanceRatio, onTimeRatio, lcCount, presentDays: presentRows.length };
}

/**
 * Task completion, sourced from maintenance_observations — the only per-employee
 * work-item table that exists, and the one supervisor/tasks.tsx already presents
 * as the task list.
 *
 * maintenance_observations has no `points` or `due_date`, so this is a plain
 * resolved/raised ratio rather than the old points-weighted one. Raising nothing
 * scores neutral full credit (as before): most employees are not expected to
 * file observations, and penalising them for that would make the score mostly a
 * measure of how often someone reports problems.
 */
async function computeTaskRatio(db: ReturnType<typeof supabaseAdmin>, employeeId: string, start: string, end: string) {
  const { data: rows } = await db
    .from('maintenance_observations')
    .select('status')
    .eq('employee_id', employeeId)
    .gte('created_at', `${start}T00:00:00Z`)
    .lte('created_at', `${end}T23:59:59Z`);

  const all = rows ?? [];
  if (all.length === 0) return { ratio: 1, onTimeAll: true, total: 0 };

  const resolved = all.filter((o: { status: string }) => o.status === 'resolved').length;

  return {
    ratio: resolved / all.length,
    // No due dates exist on observations, so "on time" degrades to "everything
    // raised this month was seen through to resolved".
    onTimeAll: resolved === all.length,
    total: all.length,
  };
}

/**
 * KPI actuals. mrm_reviews is the only place real KPI numbers are captured, and
 * it is department-level and manager-submitted (see app/(manager)/mrm.tsx,
 * whose inputs are 0-100).
 *
 * Members have no MRM row of their own, so they fall back to the task ratio.
 * That fallback is what the whole function used to do for everyone, via a bare
 * `kpiRatio = taskRatio`, which meant task performance was silently counted
 * twice for every role.
 */
async function computeKpiRatio(
  db: ReturnType<typeof supabaseAdmin>,
  category: ScoreCategory,
  department: string | null,
  monthStr: string,
  year: number,
  taskRatio: number
): Promise<number> {
  if ((category !== 'supervisor' && category !== 'manager') || !department) return taskRatio;

  const { data: review } = await db
    .from('mrm_reviews')
    .select('safety_score, quality_score, delivery_score, cost_score, morale_score')
    .eq('department', department)
    .eq('month', monthStr)
    .eq('year', year)
    .maybeSingle();

  // No review submitted yet this month — fall back rather than score a zero
  // the employee has no way to influence.
  if (!review) return taskRatio;

  const parts = [
    review.safety_score,
    review.quality_score,
    review.delivery_score,
    review.cost_score,
    review.morale_score,
  ].map((v: number | null) => Number(v ?? 0));

  const avg = parts.reduce((s, v) => s + v, 0) / parts.length;
  return Math.max(0, Math.min(1, avg / 100));
}

/**
 * 5S participation, written to monthly_scores.five_s_score.
 * Raw approved-point total: owner/eotm.tsx ranks on this column descending, so
 * an absolute total is what that screen needs.
 */
async function computeFiveSScore(db: ReturnType<typeof supabaseAdmin>, employeeId: string, start: string, end: string) {
  const { data: rows } = await db
    .from('5s_submissions')
    .select('points_awarded')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .gte('created_at', `${start}T00:00:00Z`)
    .lte('created_at', `${end}T23:59:59Z`);

  return (rows ?? []).reduce((s: number, r: { points_awarded: number }) => s + Number(r.points_awarded ?? 0), 0);
}

/**
 * Safety, written to monthly_scores.safety_score. 100 clean, each fraud flag
 * costs 20, floored at 0 — so eotm.tsx's safety category ranks on something
 * real instead of a table of zeroes.
 */
async function computeSafetyScore(db: ReturnType<typeof supabaseAdmin>, employeeId: string, start: string, end: string) {
  const { count } = await db
    .from('fraud_flags')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', employeeId)
    .gte('created_at', `${start}T00:00:00Z`)
    .lte('created_at', `${end}T23:59:59Z`);

  return Math.max(0, 100 - (count ?? 0) * 20);
}

async function computeTeamControlScore(
  db: ReturnType<typeof supabaseAdmin>,
  employeeId: string,
  department: string | null,
  start: string,
  end: string,
  workingDays: number
) {
  // data_collection_submissions is the real shift-report table (FINAL_SCHEMA
  // annotates it "(shift reports)"), and is what supervisor/shift-report.tsx
  // writes. Same supervisor_id + date shape as the old non-existent
  // `shift_reports` query, so this is a direct swap.
  const { count: reportCount } = await db
    .from('data_collection_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('supervisor_id', employeeId)
    .gte('date', start)
    .lte('date', end);

  const reportRatio = workingDays > 0 ? Math.min(1, (reportCount ?? 0) / workingDays) : 0;

  const { count: flagCount } = await db
    .from('fraud_flags')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', employeeId)
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
    .from('attendance_records')
    .select('date, status')
    .eq('employee_id', employeeId)
    .lte('date', asOf)
    .order('date', { ascending: false })
    .limit(120);

  let streak = 0;
  for (const row of rows ?? []) {
    // 'OT' is not a permitted attendance_records.status value; 'P'/'HL' are.
    if (['P', 'HL'].includes(row.status)) streak += 1;
    else if (['H', 'WO'].includes(row.status)) continue; // doesn't break streak
    else break;
  }

  if (streak >= 60) return { badge: 'gold', streak };
  if (streak >= 30) return { badge: 'bronze', streak };
  return { badge: null, streak };
}

async function generateAiSuggestion(scoreSummary: Record<string, unknown>): Promise<string | null> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return null;

  const prompt =
    'You are writing a short, encouraging, specific improvement tip for a factory worker in India, ' +
    'based on this month\'s performance score data. Keep it to 1-2 short sentences, plain language, ' +
    'no jargon, second person ("you"). Score data (0-100 scale unless noted):\n' +
    JSON.stringify(scoreSummary);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 120 },
        }),
      }
    );

    if (!res.ok) {
      console.error('Gemini API error', await res.text());
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' ? text.trim() : null;
  } catch (err) {
    console.error('Gemini API call failed', err);
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
      .select('id, role, department, name')
      .eq('is_active', true)
      .in('role', ['member', 'supervisor', 'manager']);

    if (error) return jsonResponse({ error: error.message }, 500);

    const scored: Array<{ employeeId: string; category: ScoreCategory; compositeScore: number }> = [];
    const monthStr = String(month).padStart(2, '0');

    for (const employee of employees ?? []) {
      const category = await scoreCategoryFor(db, employee);
      if (!category) continue;

      const weights = SCORE_WEIGHTS[category];

      const { attendanceRatio, onTimeRatio, lcCount, presentDays } = await computeAttendanceAndOnTime(db, employee.id, start, end);
      const { ratio: taskRatio, onTimeAll, total: taskTotal } = await computeTaskRatio(db, employee.id, start, end);
      const kpiRatio = await computeKpiRatio(db, category, employee.department, monthStr, year, taskRatio);
      const teamControlRatio =
        weights.teamControl > 0
          ? await computeTeamControlScore(db, employee.id, employee.department, start, end, presentDays || daysInMonth)
          : 0;

      const fiveSScore = await computeFiveSScore(db, employee.id, start, end);
      const safetyScore = await computeSafetyScore(db, employee.id, start, end);

      const attendanceScore = attendanceRatio * weights.attendance;
      const ontimeScore = onTimeRatio * weights.ontime;
      const taskScore = taskRatio * weights.task;
      const kpiScore = kpiRatio * weights.kpi;
      const teamControlScore = teamControlRatio * weights.teamControl;

      const brownie = computeBrownie({ lcCount, onTimeAll, taskTotal });
      const composite = attendanceScore + ontimeScore + taskScore + kpiScore + teamControlScore + brownie;

      const { badge, streak } = await computeAttendanceStreakBadge(db, employee.id, end);

      const aiSuggestion = await generateAiSuggestion({
        employee: employee.name,
        category,
        attendanceScore: Math.round(attendanceScore),
        ontimeScore: Math.round(ontimeScore),
        taskScore: Math.round(taskScore),
        kpiScore: Math.round(kpiScore),
        teamControlScore: Math.round(teamControlScore),
        fiveSScore,
        safetyScore,
        brownie,
        compositeScore: Math.round(composite),
        attendanceStreakDays: streak,
      });

      await db.from('monthly_scores').upsert(
        {
          employee_id: employee.id,
          year,
          month: String(month).padStart(2, '0'),
          attendance_score: round2(attendanceScore),
          on_time_score: round2(ontimeScore),
          task_completion_score: round2(taskScore),
          kpi_score: round2(kpiScore),
          // Always 0 — no per-employee production data is captured anywhere.
          // The column is still written so worker/score.tsx (which renders it
          // for operators) and types/index.ts keep working unchanged.
          production_score: 0,
          five_s_score: round2(fiveSScore),
          safety_score: round2(safetyScore),
          brownie_points: brownie,
          composite_score: round2(composite),
          eotm_badge: badge,
        },
        { onConflict: 'employee_id,year,month' }
      );

      scored.push({ employeeId: employee.id, category, compositeScore: composite });
    }

    // Employee-of-the-Month ranking, per category (Section 2/Module 3).
    // Top scorer per category gets eotm_badge='gold'; top-3 get 'bronze'.
    const scoreCategories: ScoreCategory[] = ['member', 'operator', 'supervisor', 'manager'];
    for (const category of scoreCategories) {
      const group = scored.filter((s) => s.category === category).sort((a, b) => b.compositeScore - a.compositeScore);
      for (let i = 0; i < group.length; i++) {
        const rank = i + 1;
        const eotmBadge = rank === 1 ? 'gold' : rank <= 3 ? 'bronze' : null;
        if (eotmBadge !== null) {
          await db
            .from('monthly_scores')
            .update({ eotm_badge: eotmBadge })
            .eq('employee_id', group[i].employeeId)
            .eq('year', year)
            .eq('month', monthStr);
        }
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
