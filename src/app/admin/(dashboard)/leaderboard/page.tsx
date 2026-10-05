import type { Metadata } from "next";
import Link from "next/link";

import { StatTile } from "@/components/admin/StatTile";
import { leaderboard } from "@/lib/leaderboard";
import { formatIst } from "@/lib/voting";

export const metadata: Metadata = {
  title: "Leaderboard · AWE Awards 2026",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const MEDAL = ["🥇", "🥈", "🥉"];

/**
 * Leaderboard: every nominee ranked by votes, with a drill-down into each
 * one's individual votes.
 *
 * Counts never leave the dashboard (section 9) -- this is the admin's live
 * view, and the public only ever sees the winner ranking once it is revealed.
 *
 * Filters are a plain GET form, so a filtered view is a URL an admin can
 * bookmark or reload during a busy vote, and the page needs no client code.
 */
export default async function LeaderboardPage({ searchParams }: PageProps<"/admin/leaderboard">) {
  const sp = await searchParams;
  const categorySlug = typeof sp.category === "string" ? sp.category : "";
  const query = typeof sp.q === "string" ? sp.q.trim() : "";

  const board = await leaderboard();

  const needle = query.toLowerCase();
  const rows = board.rows.filter(
    (row) =>
      (!categorySlug || row.categorySlug === categorySlug) &&
      (!needle ||
        row.displayName.toLowerCase().includes(needle) ||
        row.businessName.toLowerCase().includes(needle) ||
        (row.code ?? "").toLowerCase().includes(needle)),
  );

  const inCategory = Boolean(categorySlug);
  const leader = board.rows.find((r) => r.votes > 0);
  const withVotes = board.rows.filter((r) => r.votes > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-purple-royal">Leaderboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Every nominee ranked by votes. Open a nominee to see each vote she received, or download
            her votes as a spreadsheet. Counts stay on the dashboard — the public never sees them.
          </p>
        </div>
        {/* A download, not a navigation. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/admin/export/leaderboard"
          className="inline-flex shrink-0 items-center rounded-lg bg-white px-4 py-2 text-[13px]
                     font-semibold text-magenta-royal ring-1 ring-inset ring-magenta-royal/25
                     hover:bg-magenta-soft"
        >
          Download leaderboard (CSV)
        </a>
      </div>

      {board.votesUnavailable && (
        <div className="rounded-xl border border-magenta-royal/25 bg-magenta-soft px-4 py-3 text-[13px] text-magenta-dark">
          Vote data could not be read, so every count below may be wrong. Reload in a moment.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total votes" value={board.totalVotes.toLocaleString("en-IN")} />
        <StatTile
          label="Last 24 hours"
          value={board.votesLast24h.toLocaleString("en-IN")}
          tone="text-magenta-royal"
        />
        <StatTile
          label="Nominees with votes"
          value={`${withVotes} / ${board.rows.length}`}
          tone="text-gold-champagne"
        />
        <StatTile
          label="Leading overall"
          value={<span className="block truncate text-lg">{leader?.displayName ?? "—"}</span>}
          hint={leader ? `${leader.votes.toLocaleString("en-IN")} votes · ${leader.categoryName}` : "No votes yet"}
        />
      </div>

      {/* ---- filters ------------------------------------------------ */}
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
        <label className="block min-w-[12rem] flex-1">
          <span className="block text-[12px] font-medium text-ink-muted">Category</span>
          <select
            name="category"
            defaultValue={categorySlug}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-charcoal"
          >
            <option value="">All categories</option>
            {board.categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[12rem] flex-1">
          <span className="block text-[12px] font-medium text-ink-muted">Search</span>
          <input
            name="q"
            defaultValue={query}
            placeholder="Name, business or nominee ID"
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-charcoal"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-purple-royal px-5 py-2 text-[14px] font-semibold text-white hover:bg-purple-deep"
        >
          Show
        </button>
        {(categorySlug || query) && (
          <Link href="/admin/leaderboard" className="py-2 text-[13px] font-medium text-ink-muted hover:text-purple-royal">
            Clear
          </Link>
        )}
      </form>

      {/* ---- the table ---------------------------------------------- */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-12 text-center text-[13px] text-ink-muted">
          No nominees match.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[46rem] text-left text-[13px]">
            <thead className="border-b border-line bg-canvas text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">{inCategory ? "Rank" : "Overall"}</th>
                <th className="px-4 py-2.5">Nominee</th>
                {!inCategory && <th className="px-4 py-2.5">Category</th>}
                {!inCategory && <th className="px-4 py-2.5">In category</th>}
                <th className="px-4 py-2.5 text-right">Votes</th>
                <th className="px-4 py-2.5 text-right">Last 24h</th>
                <th className="px-4 py-2.5">Last vote</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                const shownRank = inCategory ? row.categoryRank : row.rank;
                return (
                  <tr key={row.id} className="hover:bg-purple-soft/30">
                    <td className="px-4 py-3 font-semibold tabular-nums text-purple-royal">
                      {row.votes > 0 && shownRank <= 3 ? `${MEDAL[shownRank - 1]} ` : ""}
                      {shownRank}
                    </td>
                    <td className="px-4 py-3">
                      {row.code && (
                        <p className="font-mono text-[11px] font-semibold tracking-wide text-ink-muted">
                          {row.code}
                        </p>
                      )}
                      <Link
                        href={`/admin/leaderboard/${row.id}`}
                        className="font-semibold text-purple-royal hover:text-magenta-royal"
                      >
                        {row.displayName}
                      </Link>
                      <p className="text-[12px] text-ink-muted">
                        {row.businessName}
                        {!row.isPublished && (
                          <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-500">
                            Hidden
                          </span>
                        )}
                      </p>
                    </td>
                    {!inCategory && <td className="px-4 py-3 text-charcoal">{row.categoryName}</td>}
                    {!inCategory && (
                      <td className="px-4 py-3 tabular-nums text-ink-muted">#{row.categoryRank}</td>
                    )}
                    <td className="px-4 py-3 text-right text-[15px] font-bold tabular-nums text-magenta-royal">
                      {row.votes.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-charcoal">
                      {row.votesLast24h > 0 ? `+${row.votesLast24h.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-ink-muted">
                      {formatIst(row.lastVoteAt) ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/admin/leaderboard/${row.id}`}
                        className="font-semibold text-magenta-royal hover:underline"
                      >
                        Votes
                      </Link>
                      <a
                        href={`/admin/export/nominee-votes?id=${row.id}`}
                        className="ml-3 font-semibold text-ink-muted hover:text-purple-royal"
                      >
                        CSV
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-ink-muted">
        Ties are ordered by who was promoted first, the same rule Results uses. Times are IST.
      </p>
    </div>
  );
}
