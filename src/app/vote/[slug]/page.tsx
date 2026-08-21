import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DarkShell } from "@/components/DarkShell";
import { NomineeCard } from "@/components/vote/NomineeCard";
import { publicCategoryPage, signNomineePhotos } from "@/lib/nominees";
import {
  categoryVotingState,
  getPublicVotingSettings,
  type CategoryVotingState,
} from "@/lib/voting";

/**
 * The category voting page (Final Plan section 6) -- one shareable link per
 * category, showing every nominee in it as a card.
 *
 * Rendered per request rather than cached: the nominee list changes as the
 * admin promotes people, and the photos are short-lived signed URLs from a
 * private bucket, which must not be baked into a cached page.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/vote/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await publicCategoryPage(slug);

  if (!category) return { title: "Category not found · AWE Awards 2026" };

  return {
    title: `${category.name} · AWE Awards 2026`,
    description: `Meet the ${category.name} nominees at the AWE Awards 2026 — celebrating women entrepreneurs.`,
  };
}

export default async function CategoryVotePage({ params }: PageProps<"/vote/[slug]">) {
  const { slug } = await params;
  const [{ category, nominees }, settings] = await Promise.all([
    publicCategoryPage(slug),
    getPublicVotingSettings(),
  ]);

  if (!category) notFound();

  const photoUrls = await signNomineePhotos(nominees.map((n) => n.photo_path));

  // The global switch, narrowed by this category's own pause. Read fresh on
  // every request, so flipping either one in the dashboard shows up here on the
  // next load with nothing to invalidate.
  const state = categoryVotingState(settings.status, {
    is_active: true,
    voting_paused: category.voting_paused,
  });

  return (
    <DarkShell>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-5 sm:py-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            AWE Awards 2026
          </p>
          <h1 className="mt-2 text-[27px] font-bold leading-tight tracking-tight text-heading sm:mt-3 sm:text-4xl">
            {category.name}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-ink-muted sm:text-[15px]">
            {nominees.length > 0
              ? `Meet the ${nominees.length} nominee${nominees.length === 1 ? "" : "s"} in this category.`
              : "Nominees for this category are being announced shortly."}
          </p>
        </div>

        {/* The schedule is real -- an admin sets it in Voting Control -- but
          * the ballot is not built yet. Both facts get said, because a
          * disabled checkbox on its own would leave a voter unsure whether
          * their tap counted. */}
        <VotingNotice state={state} />

        {nominees.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nominees.map((nominee) => (
              <NomineeCard
                key={nominee.id}
                nominee={nominee}
                photoUrl={nominee.photo_path ? (photoUrls[nominee.photo_path] ?? null) : null}
              />
            ))}
          </ul>
        ) : (
          <div className="mx-auto mt-8 max-w-lg rounded-xl border border-line bg-surface/60 px-5 py-10 text-center">
            <p className="text-sm font-medium text-heading">No nominees on this page yet.</p>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              Entries are still being reviewed. Nominees appear here as they are confirmed.
            </p>
          </div>
        )}

        <p className="mt-10 text-center text-[13px] text-ink-muted">
          Want to be on this page?{" "}
          <Link href="/register" className="font-semibold text-accent underline underline-offset-2">
            Enter the AWE Awards 2026
          </Link>
        </p>
      </main>
    </DarkShell>
  );
}

/**
 * What a visitor is told about voting, from the switches the dashboard sets
 * (Final Plan section 10, manual variant).
 *
 * Every branch is careful never to imply a vote can be cast, because none can
 * yet -- the ballot arrives with the voter portal. The state is real, so it is
 * worth showing; the ability to vote is not, so it is never claimed.
 */
function VotingNotice({ state }: { state: CategoryVotingState }) {
  const copy: Record<CategoryVotingState, { icon: string; title: string; body: string }> = {
    not_started: {
      icon: "\u{1F5F3}\u{FE0F}",
      title: "Voting has not opened yet.",
      body: "These are the nominees as they will appear. Save this page \u2014 when voting opens you will pick everyone you want to vote for here and submit once.",
    },
    open: {
      icon: "\u{1F5F3}\u{FE0F}",
      title: "Voting is open.",
      body: "The ballot goes live on this page shortly. Nothing you tap here is counted yet.",
    },
    paused: {
      icon: "\u{23F8}\u{FE0F}",
      title: "Voting is paused.",
      body: "The organisers have paused voting for the moment. Check back shortly \u2014 the nominees below are unchanged.",
    },
    category_paused: {
      icon: "\u{23F8}\u{FE0F}",
      title: "Voting is paused for this category.",
      body: "Other categories are still running. Check back shortly \u2014 the nominees below are unchanged.",
    },
    stopped: {
      icon: "\u{1F512}",
      title: "Voting has closed.",
      body: "Winners are announced by the organisers once the results are confirmed.",
    },
    hidden: {
      icon: "\u{1F512}",
      title: "This page is closed.",
      body: "Voting is not running for this category.",
    },
  };

  const { icon, title, body } = copy[state];

  return (
    <div
      className="mx-auto mt-6 flex max-w-lg items-start gap-3 rounded-xl border border-gold/30
                 bg-gold/10 px-4 py-3.5 text-left"
    >
      <span aria-hidden="true" className="mt-0.5 text-base">
        {icon}
      </span>
      <p className="text-[13px] leading-relaxed text-ink">
        <strong className="font-semibold text-heading">{title}</strong> {body}
      </p>
    </div>
  );
}
