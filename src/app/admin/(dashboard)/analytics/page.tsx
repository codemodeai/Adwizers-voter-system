import type { Metadata } from "next";
import Link from "next/link";

import { StatTile } from "@/components/admin/StatTile";
import { analyticsSummary } from "@/lib/analytics";

export const metadata: Metadata = {
  title: "Analytics · AWE Awards 2026",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Analytics (Final Plan section 5) -- admin-only, never exposed publicly.
 *
 * That is not a UI decision here: `votes` grants `anon` nothing at all and has
 * no public policy (section 9), so these numbers are unreachable without an
 * admin session no matter what any page does.
 *
 * The chart is drawn with divs rather than a charting library. It is fourteen
 * horizontal bars; a dependency would add bundle weight and a client component
 * to render something the server can emit directly as HTML.
 */
export default async function AnalyticsPage() {
  const stats = await analyticsSummary();
  const max = Math.max(1, ...stats.byCategory.map((c) => c.votes));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-purple-royal">Analytics</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Vote totals and turnout. These figures are admin-only — no public route can read them.
        </p>
      </div>

      {stats.votesUnavailable && (
        <div className="rounded-xl border border-gold-champagne/30 bg-gold-soft px-4 py-3 text-[13px] leading-relaxed text-gold-champagne">
          <strong className="font-semibold">Vote data is not available yet.</strong> Run migration{" "}
          <code className="font-mono">20260821000006_votes_results_settings.sql</code> to create the
          votes table. Nominee and category figures below are live.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Total votes" value={stats.votes} tone="text-magenta-royal" />
        <StatTile
          label="Unique voters"
          value={stats.uniqueVoters}
          tone="text-purple-royal"
          hint="By verified email"
        />
        <StatTile
          label="Nominees"
          value={stats.nominees}
          tone="text-purple-royal"
          hint={`${stats.publishedNominees} live`}
        />
        <StatTile
          label="Categories"
          value={stats.categories}
          tone="text-purple-royal"
          hint={`${stats.activeCategories} open`}
        />
        <StatTile
          label="Blocked attempts"
          value={stats.blockedAttempts}
          tone="text-gold-champagne"
          hint="Duplicates & limits"
        />
      </div>

      {/* ---- votes by category ------------------------------------ */}
      <section className="rounded-2xl border border-line bg-surface">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Votes by category
          </h2>
        </header>

        <ul className="divide-y divide-line">
          {stats.byCategory.map((category) => {
            const share = stats.votes === 0 ? 0 : Math.round((category.votes / stats.votes) * 100);
            return (
              <li key={category.categoryId} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <p className="text-sm font-semibold text-purple-royal">
                    {category.name}
                    {!category.isActive && (
                      <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                        hidden
                      </span>
                    )}
                  </p>
                  <p className="text-[13px] text-ink-muted">
                    <span className="font-semibold tabular-nums text-charcoal">
                      {category.votes}
                    </span>{" "}
                    vote{category.votes === 1 ? "" : "s"}
                    {stats.votes > 0 && ` · ${share}%`} ·{" "}
                    {category.nominees} nominee{category.nominees === 1 ? "" : "s"}
                  </p>
                </div>

                <div
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-canvas"
                  role="img"
                  aria-label={`${category.votes} votes in ${category.name}`}
                >
                  <div
                    className="h-full rounded-full bg-magenta-royal transition-all"
                    style={{ width: `${Math.round((category.votes / max) * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- leaderboard ------------------------------------------ */}
      <section className="rounded-2xl border border-line bg-surface">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Most voted nominees
          </h2>
        </header>

        {stats.topNominees.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-muted">
            No votes yet. This fills in once voting opens and the ballot is live.
          </p>
        ) : (
          <ol className="divide-y divide-line">
            {stats.topNominees.map((nominee, index) => (
              <li
                key={nominee.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 shrink-0 text-right text-[13px] font-bold tabular-nums text-ink-muted">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/nominees/${nominee.id}`}
                      className="block truncate text-sm font-semibold text-purple-royal hover:text-magenta-royal"
                    >
                      {nominee.name}
                    </Link>
                    <p className="truncate text-[12px] text-ink-muted">
                      {nominee.business} · {nominee.category}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-magenta-royal">
                  {nominee.votes}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-[12px] text-ink-muted">
        Counts update on every page load. The ballot that produces them arrives with the voter
        portal — until then these read zero.
      </p>
    </div>
  );
}
