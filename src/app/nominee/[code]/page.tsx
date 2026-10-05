import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { DarkShell } from "@/components/DarkShell";
import { ShareNominee } from "@/components/vote/ShareNominee";
import { VoteForm } from "@/components/vote/VoteForm";
import { VotingNotice } from "@/components/vote/VotingNotice";
import {
  nomineeVoteUrl,
  normaliseNomineeCode,
  publicNomineePage,
  signNomineePhotos,
} from "@/lib/nominees";
import { FORM_ORIGIN } from "@/lib/target";
import { turnstileSiteKey } from "@/lib/turnstile";
import {
  categoryVotingState,
  emailVerificationRequired,
  getPublicVotingSettings,
} from "@/lib/voting";

/**
 * A nominee's personal voting page (/nominee/AWE2026-007).
 *
 * The link a nominee shares with her own customers and community, and the one
 * place a vote is cast. It shows her alone -- never the other nominees in her
 * category, since this is her page and she is the one sending people to it.
 *
 * Rendered per request: the voting switches are read fresh, and the photo is a
 * short-lived signed URL from a private bucket that must not be cached.
 */
export const dynamic = "force-dynamic";

async function load(raw: string) {
  const code = normaliseNomineeCode(raw);
  if (!code) return { code: null, page: null };
  return { code, page: await publicNomineePage(code) };
}

export async function generateMetadata({
  params,
}: PageProps<"/nominee/[code]">): Promise<Metadata> {
  const { code: raw } = await params;
  const { page } = await load(raw);

  if (!page) return { title: "Nominee not found · AWE Awards 2026" };

  const { nominee, category } = page;
  const title = `Vote for ${nominee.display_name} · AWE Awards 2026`;
  const description = `${nominee.display_name} of ${nominee.business_name} is nominated for ${category.name} at the AWE Awards 2026. Vote for her.`;

  // The logo rather than her photo for link previews: WhatsApp caches the
  // preview image, and her photo is only reachable through a signed URL that
  // expires in half an hour.
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      ...(FORM_ORIGIN ? { images: [`${FORM_ORIGIN}/awe-logo.png`] } : {}),
    },
  };
}

export default async function NomineeVotePage({ params }: PageProps<"/nominee/[code]">) {
  const { code: raw } = await params;
  const { code, page } = await load(raw);

  if (!code || !page) notFound();

  // One canonical spelling, so `awe2026-007` typed off a poster lands on the
  // same address as everyone else's link.
  if (raw !== code) redirect(`/nominee/${code}`);

  const { nominee, category } = page;

  const [settings, requireCode, photoUrls] = await Promise.all([
    getPublicVotingSettings(),
    emailVerificationRequired(),
    signNomineePhotos([nominee.photo_path]),
  ]);

  const photoUrl = nominee.photo_path ? (photoUrls[nominee.photo_path] ?? null) : null;

  const state = categoryVotingState(settings.status, {
    is_active: true,
    voting_paused: category.voting_paused,
  });

  const links = [
    { href: nominee.social_instagram, label: "Instagram" },
    { href: nominee.social_facebook, label: "Facebook" },
    { href: nominee.social_website, label: "Website" },
  ].filter((link): link is { href: string; label: string } => Boolean(link.href));

  return (
    <DarkShell>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-5 sm:py-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            AWE Awards 2026
          </p>
          <p className="mt-2 text-[13px] font-medium text-ink-muted sm:text-sm">
            Nominated for
          </p>
          <h1 className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight text-heading sm:text-3xl">
            {category.name}
          </h1>
        </div>

        {/* ---- her profile -------------------------------------------- */}
        <section className="mx-auto mt-7 max-w-xl overflow-hidden rounded-2xl border border-line bg-surface/70">
          <div className="relative aspect-square w-full bg-raised sm:aspect-[4/3]">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={`${nominee.display_name} — ${nominee.business_name}`}
                fill
                unoptimized
                priority
                sizes="(min-width: 640px) 36rem, 100vw"
                className="object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-full items-center justify-center text-6xl font-bold text-accent/35"
              >
                {nominee.display_name.trim().charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold leading-tight tracking-tight text-heading">
                  {nominee.display_name}
                </h2>
                <p className="mt-1 text-[15px] font-semibold text-accent">
                  {nominee.business_name}
                </p>
                {nominee.area_location && (
                  <p className="mt-0.5 text-[13px] text-ink-muted">{nominee.area_location}</p>
                )}
              </div>
              <span className="shrink-0 rounded-md bg-raised px-2.5 py-1 font-mono text-[12px] font-semibold tracking-wide text-gold ring-1 ring-inset ring-line">
                {code}
              </span>
            </div>

            {nominee.bio && (
              <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-ink">
                {nominee.bio}
              </p>
            )}

            {links.length > 0 && (
              <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="font-medium text-ink-muted underline underline-offset-2 hover:text-accent"
                  >
                    {link.label}
                  </a>
                ))}
              </p>
            )}
          </div>
        </section>

        <VotingNotice state={state} page="nominee" />

        {state === "open" && (
          <VoteForm
            nomineeCode={code}
            nomineeName={nominee.display_name}
            categoryName={category.name}
            turnstileSiteKey={turnstileSiteKey()}
            requireCode={requireCode}
          />
        )}

        <ShareNominee
          url={nomineeVoteUrl(code)}
          name={nominee.display_name}
          businessName={nominee.business_name}
          categoryName={category.name}
        />
      </main>
    </DarkShell>
  );
}
