import "server-only";

type Page = { data: unknown[] | null; error: { message: string } | null };

/**
 * Every row a query matches, read a page at a time.
 *
 * Supabase caps a single select at its API's max-rows setting (1,000 by
 * default) and returns the first page *without an error* -- so a plain
 * `select()` on the votes table silently stops counting at 1,000. Anything that
 * tallies votes has to read through this instead.
 *
 * `build` receives the range for one page and must apply it with `.range()`,
 * after an `.order()` that is stable while rows are being added -- created_at
 * then id -- so a vote cast mid-read lands on a later page rather than shifting
 * one already read.
 *
 * Stops at the first empty page rather than the first short one, so a project
 * whose max-rows is set below `pageSize` is still read in full.
 */
export async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<Page>,
  pageSize = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];

  for (let from = 0; ; ) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) return { data: rows, error };

    const page = (data ?? []) as T[];
    if (page.length === 0) return { data: rows, error: null };

    rows.push(...page);
    from += page.length;
  }
}
