-- ============================================================================
-- PATCH_13 — photo storage for 5S submissions and maintenance observations
-- 11 Aug 2026
--
-- WHY: app/(worker)/5s.tsx and app/(worker)/observation.tsx never actually
-- opened a camera. They requested permission and then wrote the literal string
-- 'https://placeholder.com/5s-photo.jpg' into photo_url. supervisor/5s-verify.tsx
-- renders that URL as an <Image>, so every submission a supervisor reviews has
-- shown a broken image.
--
-- Wiring up the real camera needs somewhere to put the file, and this project
-- has no Supabase Storage bucket at all — nothing anywhere references
-- storage.objects. This patch creates it.
--
-- PATH CONVENTION (the RLS below depends on it):
--     <employee_id>/<kind>/<uuid>.jpg      e.g.  a1b2.../5s/9f8e....jpg
-- The first path segment is the owning employee's id. lib/photos.ts builds
-- exactly this shape; changing one without the other breaks uploads.
--
-- The bucket is PRIVATE. Photos are of the shop floor and are tied to a named
-- employee, so they are served via short-lived signed URLs rather than being
-- world-readable to anyone who guesses a path.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR. Safe to re-run.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('submission-photos', 'submission-photos', false)
on conflict (id) do nothing;

-- Size/MIME limits live in columns that only exist on newer Storage versions,
-- so set them defensively rather than assuming the shape of a Supabase-managed
-- table.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets'
      and column_name = 'file_size_limit'
  ) then
    -- 5 MB ceiling: capture already downscales (quality 0.5), and these are
    -- uploaded over mobile data from the shop floor.
    update storage.buckets set file_size_limit = 5242880 where id = 'submission-photos';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets'
      and column_name = 'allowed_mime_types'
  ) then
    update storage.buckets
       set allowed_mime_types = array['image/jpeg','image/png']
     where id = 'submission-photos';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. RLS on storage.objects
--
-- storage.objects already has RLS enabled by Supabase; we only add policies.
-- (storage.foldername(name) returns the path segments as text[], so
-- (storage.foldername(name))[1] is the <employee_id> prefix.)
-- ---------------------------------------------------------------------------

-- Employees upload ONLY under their own employee_id prefix. Without the prefix
-- check any authenticated user could write into a colleague's folder and
-- fabricate evidence against them.
drop policy if exists "submission_photos_insert_own" on storage.objects;
create policy "submission_photos_insert_own" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'submission-photos'
    and (storage.foldername(name))[1] = current_employee_id()::text
  );

-- Read: your own photos; your supervisor's/manager's view of your photos; and
-- management. Supervisors must be able to see submissions to verify them
-- (supervisor/5s-verify.tsx) and to action maintenance observations
-- (supervisor/tasks.tsx).
drop policy if exists "submission_photos_select_scoped" on storage.objects;
create policy "submission_photos_select_scoped" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'submission-photos'
    and (
      (storage.foldername(name))[1] = current_employee_id()::text
      or is_management()
      or (storage.foldername(name))[1] in (
        select id::text from employees where supervisor_id = current_employee_id()
      )
      or (storage.foldername(name))[1] in (
        select id::text from employees where manager_id = current_employee_id()
      )
    )
  );

-- Deliberately NO update or delete policy. With RLS enabled and no policy,
-- both are denied by default — a submitted photo is evidence and should not be
-- swappable or removable after the fact. This matches the schema-wide decision
-- to omit DELETE policies for audit-trail reasons.

commit;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Bucket exists and is private (expect one row, public = false):
--   select id, name, public from storage.buckets where id = 'submission-photos';
--
-- Policies present (expect the two named below, and NO update/delete ones):
--   select policyname, cmd from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--     and policyname like 'submission_photos%';
--
-- After a worker submits a 5S photo, the stored path should start with their
-- employees.id:
--   select photo_url from "5s_submissions" order by created_at desc limit 5;
-- ============================================================================
