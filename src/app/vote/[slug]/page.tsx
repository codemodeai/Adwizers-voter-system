import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DarkShell } from "@/components/DarkShell";
import { NomineeCard } from "@/components/vote/NomineeCard";
import { VotingNotice } from "@/components/vote/VotingNotice";
import { publicCategoryPage, signNomineePhotos } from "@/lib/nominees";
import { categoryVotingState, getPublicVotingSettings } from "@/lib/voting";

/**
 * A category's directory page -- every nominee in it as a card, each with a
 * button through to her personal voting page (/nominee/AWE2026-007).
 *
 * Voting used to happen here, with one link per category. It moved to one link
 * per nominee, which she shares with her own customers; this page stays so the
 * category links already sent out keep leading to the nominees rather than to
 * a dead end. No vote is cast on this page.
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

        <VotingNotice state={state} page="directory" />

        {nominees.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nominees.map((nominee) => (
              <NomineeCard
                key={nominee.id}
                nominee={nominee}
                photoUrl={nominee.photo_path ? (photoUrls[nominee.photo_path] ?? null) : null}
                href={nominee.code ? `/nominee/${nominee.code}` : null}
                votingOpen={state === "open"}
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
