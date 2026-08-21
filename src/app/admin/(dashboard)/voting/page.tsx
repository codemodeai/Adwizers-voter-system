import type { Metadata } from "next";
import Link from "next/link";

import { PauseVotingButton } from "@/components/admin/PauseVotingButton";
import { VotingScheduleForm } from "@/components/admin/VotingScheduleForm";
import { categoryVoteUrl, listCategoriesWithNominees } from "@/lib/nominees";
import { formatIst, getVotingSettings, votingState, VOTING_STATE_LABEL } from "@/lib/voting";

export const metadata: Metadata = {
  title: "Voting Control · AWE Awards 2026",
  robots: { index: false },
};

/** State is derived from the clock, so this screen must never be cached. */
export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  unscheduled: "border-line bg-surface text-ink-muted",
  scheduled: "border-purple-royal/20 bg-purple-soft text-purple-royal",
  open: "border-magenta-royal/25 bg-magenta-soft text-magenta-royal",
  paused: "border-gold-champagne/30 bg-gold-soft text-gold-champagne",
  closed: "border-line-strong bg-canvas text-charcoal",
};

/**
 * Voting Control (Final Plan sections 5 and 10).
 *
 * The state at the top is computed from the clock on every request, which is
 * what "voting auto-locks the moment the end time hits" means in practice --
 * there is no job to run and nothing to go stale.
 */
export default async function VotingPage() {
  const [settings, groups] = await Promise.all([
    getVotingSettings(),
    listCategoriesWithNominees(),
  ]);

  const state = votingState(settings);
  const opens = formatIst(settings.starts_at);
  const closes = formatIst(settings.ends_at);

  const liveCategories = groups.filter((g) => g.is_active);
  const totalLive = liveCategories.reduce((sum, g) => sum + g.publishedCount, 0);
  const emptyLive = liveCategories.filter((g) => g.publishedCount === 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-purple-royal">Voting Control</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          One voting window covers every category. Voting closes itself when the end time passes;
          the pause is for handling problems mid-window without disturbing the dates.
        </p>
      </div>

      {/* ---- where things stand right now ------------------------- */}
      <section className={`rounded-2xl border px-5 py-5 ${TONE[state]}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            aria-hidden="true"
            className={`size-2.5 rounded-full ${
              state === "open"
                ? "animate-pulse bg-magenta-royal"
                : state === "paused"
                  ? "bg-gold-champagne"
                  : state === "scheduled"
                    ? "bg-purple-royal"
                    : "bg-neutral-400"
            }`}
          />
          <h2 className="text-xl font-bold tracking-tight">{VOTING_STATE_LABEL[state]}</h2>
        </div>

        <p className="mt-1.5 text-[13px] leading-relaxed opacity-90">
          {state === "unscheduled" &&
            "No dates set. Every category page tells visitors voting has not opened yet."}
          {state === "scheduled" && `Voting opens ${opens} IST and closes ${closes} IST.`}
          {state === "open" && `Voting is live now and closes automatically at ${closes} IST.`}
          {state === "paused" &&
            `Paused by an admin. The window still runs ${opens} to ${closes} IST — resume to put it back in force.`}
          {state === "closed" && `Voting closed at ${closes} IST. No further votes can be cast.`}
        </p>
      </section>

      {/* ---- pause ------------------------------------------------ */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
          Pause switch
        </h2>
        <div className="mt-3.5">
          <PauseVotingButton paused={settings.is_paused} live={state === "open"} />
        </div>
      </section>

      {/* ---- the window ------------------------------------------- */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
          Voting window
        </h2>
        <div className="mt-4">
          <VotingScheduleForm startsAt={settings.starts_at} endsAt={settings.ends_at} />
        </div>

        {(opens || closes) && (
          <dl className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
                Opens
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-charcoal">{opens ?? "—"} IST</dd>
            </div>
            <div>
              <dt className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
                Closes
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-charcoal">{closes ?? "—"} IST</dd>
            </div>
          </dl>
        )}
      </section>

      {/* ---- per-category status (section 5) ---------------------- */}
      <section className="rounded-2xl border border-line bg-surface">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Status by category
          </h2>
          <p className="text-[13px] text-ink-muted">
            <span className="font-semibold text-magenta-royal">{totalLive}</span> nominee
            {totalLive === 1 ? "" : "s"} across {liveCategories.length} open categories
            {emptyLive > 0 && ` · ${emptyLive} with nobody on it`}
          </p>
        </header>

        <ul className="divide-y divide-line">
          {groups.map((group) => {
            // A category with no nominees is open to a page with nothing to
            // vote for, which is worth flagging before the window starts.
            const effective = !group.is_active
              ? "Category hidden"
              : group.publishedCount === 0
                ? "No nominees"
                : VOTING_STATE_LABEL[state];

            const muted = !group.is_active || group.publishedCount === 0;

            return (
              <li
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-purple-royal">{group.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[12px] text-ink-muted">
                    {categoryVoteUrl(group.slug)}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-md px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset ${
                    muted
                      ? "bg-neutral-100 text-neutral-500 ring-line"
                      : state === "open"
                        ? "bg-magenta-soft text-magenta-royal ring-magenta-royal/20"
                        : state === "paused"
                          ? "bg-gold-soft text-gold-champagne ring-gold-champagne/25"
                          : "bg-purple-soft text-purple-royal ring-purple-royal/15"
                  }`}
                >
                  {effective}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* The honest caveat: the schedule is real, the ballot is not built. */}
      <div className="rounded-xl border border-gold-champagne/30 bg-gold-soft px-4 py-3 text-[13px] leading-relaxed text-gold-champagne">
        <strong className="font-semibold">The ballot itself is still to come.</strong> This schedule
        is live and the category pages honour it, but the vote form — Turnstile, the emailed code,
        and the duplicate-vote rules from plan section 8 — arrives with the voter portal. Until
        then a category page shows the schedule and the nominee cards without accepting a vote.{" "}
        <Link href="/admin/categories" className="underline underline-offset-2">
          See the category pages
        </Link>
        .
      </div>
    </div>
  );
}
