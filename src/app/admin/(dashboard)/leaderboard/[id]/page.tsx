import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatTile } from "@/components/admin/StatTile";
import { leaderboard, nomineeVotes } from "@/lib/leaderboard";
import { formatIst } from "@/lib/voting";

export const metadata: Metadata = {
  title: "Nominee votes · AWE Awards 2026",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Rows rendered on screen. The CSV always carries every vote. */
const SHOWN = 200;

/**
 * One nominee's votes: where she stands, and every vote she received with the
 * voter's details and receipt reference -- the record to check a claimed vote
 * against ("I voted for her, my reference is AWE-…").
 *
 * Voter details are personal data, which is why this lives behind the admin
 * session alongside the rest of the vote data, and nowhere else.
 */
export default async function NomineeVotesPage({ params }: PageProps<"/admin/leaderboard/[id]">) {
  const { id } = await params;
  const [detail, board] = await Promise.all([nomineeVotes(id), leaderboard()]);
  if (!detail) notFound();

  const { nominee, votes, blockedAttempts, error } = detail;
  const standing = board.rows.find((r) => r.id === id);
  const shown = votes.slice(0, SHOWN);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={
            nominee.categories
              ? `/admin/leaderboard?category=${nominee.categories.slug}`
              : "/admin/leaderboard"
          }
          className="text-[13px] font-medium text-ink-muted hover:text-purple-royal"
        >
          ← Leaderboard{nominee.categories ? ` · ${nominee.categories.name}` : ""}
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {nominee.code && (
              <p className="font-mono text-[12px] font-semibold tracking-wide text-magenta-royal">
                {nominee.code}
              </p>
            )}
            <h1 className="truncate text-2xl font-bold tracking-tight text-purple-royal">
              {nominee.display_name}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {nominee.business_name}
              {nominee.categories ? ` · ${nominee.categories.name}` : ""}
              {!nominee.is_published && " · hidden"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/nominees/${nominee.id}`}
              className="rounded-lg px-3.5 py-2 text-[13px] font-semibold text-magenta-royal ring-1 ring-inset ring-magenta-royal/25 hover:bg-magenta-soft"
            >
              Profile &amp; link
            </Link>
            <a
              href={`/admin/export/nominee-votes?id=${nominee.id}`}
              className="rounded-lg bg-magenta-royal px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-magenta-dark"
            >
              Download her votes (CSV)
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-magenta-royal/25 bg-magenta-soft px-4 py-3 text-[13px] text-magenta-dark">
          Her votes could not be read ({error}). The numbers below may be incomplete — reload in a
          moment.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Votes" value={votes.length.toLocaleString("en-IN")} tone="text-magenta-royal" />
        <StatTile
          label="Rank in category"
          value={standing ? `#${standing.categoryRank}` : "—"}
          hint={standing ? `#${standing.rank} overall` : undefined}
        />
        <StatTile
          label="Last 24 hours"
          value={standing ? `+${standing.votesLast24h.toLocaleString("en-IN")}` : "—"}
          tone="text-gold-champagne"
        />
        <StatTile
          label="Blocked attempts"
          value={blockedAttempts.toLocaleString("en-IN")}
          tone="text-ink-muted"
          hint="Duplicate votes refused for her"
        />
      </div>

      {votes.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-12 text-center">
          <p className="text-sm font-medium text-charcoal">No votes yet.</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Votes appear here as soon as they are cast on her link.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[52rem] text-left text-[13px]">
            <thead className="border-b border-line bg-canvas text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">#</th>
                <th className="px-4 py-2.5">Time (IST)</th>
                <th className="px-4 py-2.5">Reference</th>
                <th className="px-4 py-2.5">Voter</th>
                <th className="px-4 py-2.5">Mobile</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((vote, index) => (
                <tr key={vote.id}>
                  <td className="px-4 py-2.5 tabular-nums text-ink-muted">{votes.length - index}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-charcoal">
                    {formatIst(vote.created_at)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] font-semibold text-magenta-royal">
                    {vote.vote_ref}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-charcoal">{vote.voter_name}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-charcoal">
                    {vote.voter_mobile}
                  </td>
                  <td className="px-4 py-2.5 text-charcoal">{vote.voter_email}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{vote.voter_location || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {votes.length > SHOWN && (
            <p className="border-t border-line px-4 py-3 text-[13px] text-ink-muted">
              Showing the latest {SHOWN.toLocaleString("en-IN")} of{" "}
              {votes.length.toLocaleString("en-IN")} votes. The CSV has all of them.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
