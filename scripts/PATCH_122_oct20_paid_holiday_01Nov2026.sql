-- PATCH_122: 20 Oct 2026 paid public holiday (owner, 1 Nov 2026: "20 Oct 2026 was a paid holiday").
-- Writes attendance_records status 'H' for 2026-10-20 for active non-consultant, non-BUNG
-- employees with at least one present day (P/L/HL) in Oct 2026 and NO existing row on 20 Oct.
-- Consultants (CON%) have no holiday column and BUNG have no attendance yet: excluded.
-- INSERT only; ON CONFLICT DO NOTHING (an existing row always wins). Mirrors PATCH_86 columns
-- (employee_id, date, status only). feedSync maps 'H' -> ph=1; dashboards exclude H from present.
-- Applied live 1 Nov 2026: 85 rows (68 staff, 17 worker).
-- Not eligible, for the record: VFL4041 (L) and VFL5430 (P) actually attended on 20 Oct (row kept);
-- no present day in Oct: VFL1520, VFL1557, VFL5439, VFL5457, VFL4072.
insert into public.attendance_records (employee_id, date, status)
select e.id, date '2026-10-20', 'H'
from public.employees e
where e.is_active
  and e.emp_code not like 'CON%'
  and e.emp_code not like 'BUNG%'
  and exists (select 1 from public.attendance_records a
              where a.employee_id = e.id
                and a.date between '2026-10-01' and '2026-10-31'
                and a.status in ('P','L','HL'))
  and not exists (select 1 from public.attendance_records a
                  where a.employee_id = e.id and a.date = '2026-10-20')
on conflict (employee_id, date) do nothing;
