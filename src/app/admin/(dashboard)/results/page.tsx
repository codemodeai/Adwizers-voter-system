import type { Metadata } from "next";
import Link from "next/link";

import { RevealButton } from "@/components/admin/RevealButton";
import { formUrl } from "@/lib/target";
import { categoryStandings, WINNERS_PER_CATEGORY } from "@/lib/results";
import {
  formatIst,
  getVotingRules,
  getVotingSettings,
  VOTING_STATUS_LABEL,
} from "@/lib/voting";

export const metadata: Metadata = {
  title: "Results / Winners · AWE Awards 2026",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const MEDAL = ["🥇", "🥈", "🥉"];

/**
 * Results / Winners (Final Plan section 11).
 *
 * Counts are visible here and nowhere else: they stay admin-only for the whole
 * voting period, and revealing publishes the *ranking* to a public page without
 * ever publishing the tallies. That separation is why publishing writes a
 * snapshot table rather than opening up the votes table.
 */
export default async function ResultsPage() {
  const [settings, rules, standings] = await Promise.all([
    getVotingSettings(),
    getVotingRules(),
    categoryStandings(),
  ]);

  const published = Boolean(rules.results_published_at);
  const canPublish = settings.status === "stopped";
  const withVotes = standings.filter((c) => c.rows.some((r) => r.votes > 0));
  const totalVotes = standings.reduce((sum, c) => sum + c.totalVotes, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-purple-royal">Results / Winners</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          The top {WINNERS_PER_CATEGORY} in each category. Vote counts stay on this screen — the
          public winner page shows the ranking only, and only once you reveal it.
        </p>
      </div>

      {/* ---- reveal state ----------------------------------------- */}
      <section
        className={`rounded-2xl border px-5 py-5 ${
          published
            ? "border-magenta-royal/25 bg-magenta-soft"
            : "border-line bg-surface"
        }`}
      >
        <h2
          className={`text-lg font-bold tracking-tight ${
            published ? "text-magenta-royal" : "text-purple-royal"
          }`}
        >
          {published ? "Winners are published" : "Winners are not published"}
        </h2>

        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
          {published ? (
            <>
              Revealed {formatIst(rules.results_published_at)} IST.{" "}
              <a
                href={formUrl("/winners")}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-magenta-royal underline underline-offset-2"
              >
                View the public page ↗
              </a>
            </>
          ) : (
            <>
              Nothing is shown publicly. Voting is currently{" "}
              <strong className="font-semibold text-charcoal">
                {VOTING_STATUS_LABEL[settings.status].toLowerCase()}
              </strong>
              .
            </>
          )}
        </p>

        <div className="mt-4">
          <RevealButton
            published={published}
            canPublish={canPublish}
            reason={
              totalVotes === 0
                ? "No votes have been cast yet, so there is nothing to reveal."
                : `Stop voting first — results can only be revealed once voting has closed. Voting is ${VOTING_STATUS_LABEL[settings.status].toLowerCase()}.`
            }
          />
        </div>
      </section>

      {/* ---- standings -------------------------------------------- */}
      {totalVotes === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-5 py-14 text-center">
          <p className="text-sm font-medium text-charcoal">No votes yet.</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
            Standings appear here as votes come in. The ballot that produces them arrives with the
            voter portal — see{" "}
            <Link href="/admin/voting" className="underline underline-offset-2">
              Voting Control
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {withVotes.map((category) => (
            <section key={category.categoryId} className="rounded-2xl border border-line bg-surface">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3.5">
                <h2 className="text-sm font-bold text-purple-royal">{category.name}</h2>
                <p className="text-[13px] text-ink-muted">
                  <span className="font-semibold tabular-nums text-charcoal">
                    {category.totalVotes}
                  </span>{" "}
                  vote{category.totalVotes === 1 ? "" : "s"} cast
                </p>
              </header>

              <ol className="divide-y divide-line">
                {category.rows
                  .filter((row) => row.votes > 0)
                  .map((row) => (
                    <li
                      key={row.nomineeId}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-7 shrink-0 text-center text-[15px] font-bold tabular-nums text-ink-muted">
                          {MEDAL[row.rank - 1] ?? row.rank}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/nominees/${row.nomineeId}`}
                            className="block truncate text-sm font-semibold text-purple-royal hover:text-magenta-royal"
                          >
                            {row.displayName}
                          </Link>
                          <p className="truncate text-[12px] text-ink-muted">{row.businessName}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-magenta-royal">
                        {row.votes}
                      </span>
                    </li>
                  ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-ink-muted">
        Ties are broken by who was promoted first, so a tied ranking stays in the same order between
        page loads. Nominees with no votes are never published as winners, even where a category has
        fewer than {WINNERS_PER_CATEGORY} nominees with votes.
      </p>
    </div>
  );
}
