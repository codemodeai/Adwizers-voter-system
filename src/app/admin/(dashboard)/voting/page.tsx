import type { Metadata } from "next";
import Link from "next/link";

import {
  AllCategoriesToggle,
  CategoryVotingToggle,
} from "@/components/admin/CategoryVotingToggle";
import { VotingSwitch } from "@/components/admin/VotingSwitch";
import { categoryVoteUrl, listCategoriesWithNominees } from "@/lib/nominees";
import {
  CATEGORY_STATE_LABEL,
  VOTING_STATUS_LABEL,
  categoryVotingState,
  getVotingSettings,
  type CategoryVotingState,
} from "@/lib/voting";

export const metadata: Metadata = {
  title: "Voting Control · AWE Awards 2026",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const BANNER: Record<string, string> = {
  not_started: "border-line bg-surface text-ink-muted",
  open: "border-magenta-royal/25 bg-magenta-soft text-magenta-royal",
  paused: "border-gold-champagne/30 bg-gold-soft text-gold-champagne",
  stopped: "border-line-strong bg-canvas text-charcoal",
};

const CHIP: Record<CategoryVotingState, string> = {
  open: "bg-magenta-soft text-magenta-royal ring-magenta-royal/20",
  paused: "bg-gold-soft text-gold-champagne ring-gold-champagne/25",
  category_paused: "bg-gold-soft text-gold-champagne ring-gold-champagne/25",
  stopped: "bg-neutral-100 text-neutral-600 ring-line",
  not_started: "bg-purple-soft text-purple-royal ring-purple-royal/15",
  hidden: "bg-neutral-100 text-neutral-500 ring-line",
};

/**
 * Voting Control (Final Plan section 5, manual variant of section 10).
 *
 * The schedule is gone at the client's direction: voting is a switch an admin
 * throws, with a second switch per category so one can be held while the rest
 * keep running. Nothing here moves on a timer, which means nothing closes
 * voting on its own -- the screen says so rather than leaving it to be
 * discovered.
 */
export default async function VotingPage() {
  const [settings, groups] = await Promise.all([
    getVotingSettings(),
    listCategoriesWithNominees(),
  ]);

  const status = settings.status;
  const globallyOpen = status === "open";

  const liveCategories = groups.filter((g) => g.is_active);
  const pausedCount = liveCategories.filter((g) => g.voting_paused).length;
  const totalLive = liveCategories.reduce((sum, g) => sum + g.publishedCount, 0);
  const emptyLive = liveCategories.filter((g) => g.publishedCount === 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-purple-royal">Voting Control</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Voting is switched by hand — there is no schedule. Start it when you are ready, pause
          individual categories if one needs attention, and stop it when the vote is over.
        </p>
      </div>

      {/* ---- the switch ------------------------------------------- */}
      <section className={`rounded-2xl border px-5 py-5 ${BANNER[status]}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            aria-hidden="true"
            className={`size-2.5 rounded-full ${
              status === "open"
                ? "animate-pulse bg-magenta-royal"
                : status === "paused"
                  ? "bg-gold-champagne"
                  : "bg-neutral-400"
            }`}
          />
          <h2 className="text-xl font-bold tracking-tight">{VOTING_STATUS_LABEL[status]}</h2>
        </div>

        <p className="mt-1.5 text-[13px] leading-relaxed opacity-90">
          {status === "not_started" &&
            "Voting has never been opened. Every category page tells visitors voting has not opened yet."}
          {status === "open" && (
            <>
              Votes are being accepted
              {pausedCount > 0
                ? ` on every open category except ${pausedCount} that ${pausedCount === 1 ? "is" : "are"} paused below.`
                : " on every open category."}{" "}
              Nothing closes voting on its own — press Stop when the vote is over.
            </>
          )}
          {status === "paused" &&
            "Paused everywhere. The category pages stay up with their nominee cards; no votes are accepted until you resume."}
          {status === "stopped" &&
            "Voting is closed. Every category page says so. Reopening is possible but the pages have already told visitors it ended."}
        </p>

        <div className="mt-4">
          <VotingSwitch status={status} />
        </div>
      </section>

      {/* ---- per-category ----------------------------------------- */}
      <section className="rounded-2xl border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Voting by category
            </h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              <span className="font-semibold text-magenta-royal">{totalLive}</span> nominee
              {totalLive === 1 ? "" : "s"} across {liveCategories.length} open categories
              {pausedCount > 0 && ` · ${pausedCount} paused`}
              {emptyLive > 0 && ` · ${emptyLive} with nobody on it`}
            </p>
          </div>
          <AllCategoriesToggle anyPaused={pausedCount > 0} />
        </header>

        <ul className="divide-y divide-line">
          {groups.map((group) => {
            const state = categoryVotingState(status, group);
            const noNominees = group.is_active && group.publishedCount === 0;

            return (
              <li
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-purple-royal">{group.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[12px] text-ink-muted">
                    {categoryVoteUrl(group.slug)}
                  </p>
                  {noNominees && (
                    <p className="mt-0.5 text-[12px] font-medium text-magenta-dark">
                      No nominees — this page has nothing to vote for
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-semibold
                                ring-1 ring-inset ${CHIP[state]}`}
                  >
                    {CATEGORY_STATE_LABEL[state]}
                  </span>

                  {/* Hiding a category is a Categories-screen decision; this
                    * screen only governs voting, so a hidden one gets a link
                    * rather than a switch that would not mean anything. */}
                  {group.is_active ? (
                    <CategoryVotingToggle
                      id={group.id}
                      paused={group.voting_paused}
                      globallyOpen={globallyOpen}
                    />
                  ) : (
                    <Link
                      href="/admin/categories"
                      className="whitespace-nowrap text-[12px] font-semibold text-magenta-royal hover:underline"
                    >
                      Unhide
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {!globallyOpen && pausedCount > 0 && (
          <p className="border-t border-line px-5 py-3 text-[13px] text-ink-muted">
            {pausedCount} categor{pausedCount === 1 ? "y is" : "ies are"} pre-paused and will stay
            paused when voting starts.
          </p>
        )}
      </section>

      {/* The honest caveat: the switch is real, the ballot is not built. */}
      <div className="rounded-xl border border-gold-champagne/30 bg-gold-soft px-4 py-3 text-[13px] leading-relaxed text-gold-champagne">
        <strong className="font-semibold">The ballot itself is still to come.</strong> These
        switches are live and the category pages honour them, but the vote form — Turnstile, the
        emailed code, and the duplicate-vote rules from plan section 8 — arrives with the voter
        portal. Until then a category page shows its state and its nominee cards without accepting
        a vote.{" "}
        <Link href="/admin/categories" className="underline underline-offset-2">
          See the category pages
        </Link>
        .
      </div>
    </div>
  );
}
