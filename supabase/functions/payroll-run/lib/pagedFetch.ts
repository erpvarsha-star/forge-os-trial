// VENDORED COPY of lib/payroll/pagedFetch.ts — do not edit here; edit the source and re-vendor.
/**
 * Forge OS — Generic page-safe row fetcher (pure, testable; no I/O).
 *
 * Root cause this exists to fix (found 17 Nov 2026): PostgREST silently caps an
 * unbounded `.select()` at the project's configured max-rows setting (observed
 * ~1000 here) and returns the truncated page with NO error. A single-shot select
 * on a table that can exceed that cap therefore returns an incomplete result with
 * no sign anything is wrong — this is exactly what happened to
 * `supabase/functions/payroll-run/index.ts`'s `loadFeeds()` reading
 * `attendance_records` for a pay period (confirmed live: 4,299 rows total,
 * 2,731 in October 2026 alone), silently starving the October payroll run of most
 * employees' real attendance.
 *
 * `fetchAllPages` pages through offset/limit windows until a page comes back
 * shorter than the requested page size — the only reliable "that was the last
 * page" signal PostgREST gives (a `count`-based approach would need a second
 * round trip and can still race with concurrent writes).
 *
 * `fetchPage` is injected so this can be unit-tested with a stub that returns
 * synthetic pages — no real Supabase/PostgREST client involved. The edge
 * function wrapper (supabase/functions/payroll-run/index.ts's `fetchAllRows`)
 * supplies the real `(offset, limit) => Promise<T[]>` closure over a Supabase
 * query builder.
 */
export async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  if (pageSize <= 0) throw new Error('fetchAllPages: pageSize must be > 0');
  const all: T[] = [];
  let offset = 0;
  // Safety valve: guards against a fetchPage bug that always returns a
  // full page (e.g. ignoring offset) looping forever. 10,000 pages at the
  // default pageSize is 10M rows — far past anything this project will
  // ever see, so hitting this is itself a sign something is wrong upstream.
  const MAX_PAGES = 10_000;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await fetchPage(offset, pageSize);
    all.push(...page);
    if (page.length < pageSize) return all;
    offset += pageSize;
  }
  throw new Error(`fetchAllPages: exceeded ${MAX_PAGES} pages — aborting to avoid an infinite loop`);
}
