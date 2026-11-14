-- PATCH_89: production_records process + dropout_qty (17 Oct 2026)
-- Why: syncProductionToSupabase() in ALERT.gs read RAW_* tabs by column
-- position. Forge/Press/Machine tabs have an extra Prod_Type / Process column
-- before VF_No, so vf_no got the production type and qty got the VF number
-- (NaN -> null): every Forge/Press/Machine qty has been null since April.
-- The fixed script maps columns by header name and also pushes two fields the
-- table had nowhere to store: Prod_Type/Process and Dropout_Qty (Forge/Press).
--
-- ORDER MATTERS: apply this BEFORE the updated Apps Script runs. PostgREST
-- rejects a payload containing unknown columns, which would make the whole
-- nightly production push throw.
alter table public.production_records add column if not exists process text;
alter table public.production_records add column if not exists dropout_qty numeric;

-- POST-CUTOVER CLEANUP (run only after the new script has run once).
-- The old mis-mapped Forge/Press/Machine rows (vf_no = "Forging Production" /
-- "First Side", qty null) have row_keys the new script never produces, so they
-- stay behind. Do NOT select them by synced_at alone: supabasePush_ upserts
-- with merge-duplicates and sends no synced_at, so a corrected row that lands
-- on an old key keeps the OLD synced_at. Match the broken shape instead —
-- qty null AND process null — which a corrected row never has unless its
-- sheet row itself is blank. Check the count first.
-- select department, count(*) from public.production_records
--  where department in ('Forge Shop','Press Shop','Machine Shop')
--    and qty is null and process is null
--  group by 1;
-- delete from public.production_records
--  where department in ('Forge Shop','Press Shop','Machine Shop')
--    and qty is null and process is null;
