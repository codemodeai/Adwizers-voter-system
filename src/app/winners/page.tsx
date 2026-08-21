import type { Metadata } from "next";
import Link from "next/link";

import { DarkShell } from "@/components/DarkShell";
import { signNomineePhotos } from "@/lib/nominees";
import { publishedWinners } from "@/lib/results";

export const metadata: Metadata = {
  title: "Winners · AWE Awards 2026",
  description: "The winners of the AWE Awards 2026 — celebrating women entrepreneurs.",
};

/** Reveal state changes without a deploy, and the photos are short-lived
 *  signed URLs, so this cannot be cached. */
export const dynamic = "force-dynamic";

const MEDAL = ["🥇", "🥈", "🥉"];

/**
 * The public winner page (Final Plan section 11).
 *
 * Reads the snapshot written at reveal, never the votes table. That is what
 * lets this page exist while section 9's rule holds: the ranking is public,
 * the counts never are. Nothing on this page can leak a tally because nothing
 * on it reads one.
 *
 * Before the admin reveals, this is a holding page rather than a 404 -- the URL
 * gets shared ahead of the announcement, and a dead link reads as a broken site.
 */
export default async function WinnersPage() {
  const { publishedAt, categories } = await publishedWinners();

  const photoUrls = await signNomineePhotos(
    categories.flatMap((c) => c.winners.map((w) => w.nominee?.photo_path ?? null)),
  );

  return (
    <DarkShell>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-5 sm:py-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            AWE Awards 2026
          </p>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight text-heading sm:mt-3 sm:text-4xl">
            {publishedAt ? "The Winners" : "Winners"}
          </h1>
        </div>

        {!publishedAt ? (
          <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-gold/30 bg-gold/10 px-5 py-10 text-center">
            <p className="text-base font-semibold text-heading">
              Results have not been announced yet.
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-muted">
              Voting results are published here once the organisers confirm them. Save this page and
              check back.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block text-[13px] font-semibold text-accent underline underline-offset-2"
            >
              Back to AWE Awards 2026
            </Link>
          </div>
        ) : (
          <>
            <p className="mx-auto mt-3 max-w-lg text-center text-sm text-ink-muted sm:text-[15px]">
              Congratulations to every woman named below, and to everyone who entered.
            </p>

            <div className="mt-10 space-y-9">
              {categories.map((category) => (
                <section key={category.categoryId}>
                  <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">
                    {category.name}
                  </h2>
                  <div className="mt-1 h-px w-full bg-gold/25" />

                  <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {category.winners.map((winner) => {
                      if (!winner.nominee) return null;
                      const photo = winner.nominee.photo_path
                        ? (photoUrls[winner.nominee.photo_path] ?? null)
                        : null;

                      return (
                        <li
                          key={winner.nominee.id}
                          className={`flex items-center gap-3.5 rounded-2xl border p-3.5 ${
                            winner.rank === 1
                              ? "border-gold/45 bg-gold/10"
                              : "border-line bg-surface/70"
                          }`}
                        >
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt=""
                              aria-hidden="true"
                              className="size-14 shrink-0 rounded-xl object-cover ring-1 ring-line"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="flex size-14 shrink-0 items-center justify-center rounded-xl
                                         bg-raised text-lg font-bold text-accent/60"
                            >
                              {winner.nominee.display_name.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5">
                              <span aria-hidden="true" className="text-[13px]">
                                {MEDAL[winner.rank - 1] ?? ""}
                              </span>
                              <span className="text-[11px] font-bold uppercase tracking-wide text-gold">
                                {winner.rank === 1 ? "Winner" : `Rank ${winner.rank}`}
                              </span>
                            </p>
                            <p className="mt-0.5 truncate text-[15px] font-bold leading-tight text-heading">
                              {winner.nominee.display_name}
                            </p>
                            <p className="truncate text-[13px] font-medium text-accent">
                              {winner.nominee.business_name}
                            </p>
                            {winner.nominee.area_location && (
                              <p className="truncate text-[12px] text-ink-muted">
                                {winner.nominee.area_location}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </DarkShell>
  );
}
