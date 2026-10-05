import Image from "next/image";
import Link from "next/link";

import type { PublicNominee } from "@/lib/nominees";

/**
 * A nominee's card on her category's directory page: photo, name, business,
 * short bio, and a button through to her personal page.
 *
 * Votes are cast on that personal page, never here, so the card carries no
 * checkbox. The button reads "Vote" only while voting is actually open in this
 * category; otherwise it is a plain "View" so nobody believes a tap counted.
 * A card without a number (a row that predates the column) has nowhere to go
 * and simply shows no button.
 */
export function NomineeCard({
  nominee,
  photoUrl,
  href,
  votingOpen,
}: {
  nominee: PublicNominee;
  photoUrl: string | null;
  /** Her personal page, or null when she has no number to link to. */
  href: string | null;
  votingOpen: boolean;
}) {
  const links = [
    { href: nominee.social_instagram, label: "Instagram" },
    { href: nominee.social_facebook, label: "Facebook" },
    { href: nominee.social_website, label: "Website" },
  ].filter((link): link is { href: string; label: string } => Boolean(link.href));

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface/70">
      <div className="relative aspect-[4/3] w-full bg-raised">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`${nominee.display_name} — ${nominee.business_name}`}
            fill
            unoptimized
            sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw"
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-full items-center justify-center text-3xl font-bold text-accent/35"
          >
            {nominee.display_name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold leading-tight text-heading">
            {nominee.display_name}
          </h2>
          <p className="mt-0.5 truncate text-[13px] font-medium text-accent">
            {nominee.business_name}
          </p>
          {nominee.area_location && (
            <p className="mt-0.5 truncate text-[12px] text-ink-muted">{nominee.area_location}</p>
          )}
        </div>

        {nominee.bio && (
          <p className="line-clamp-4 text-[13px] leading-relaxed text-ink-muted">{nominee.bio}</p>
        )}

        {links.length > 0 && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-[12px]">
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

        {href && (
          <Link
            href={href}
            className={`mt-auto block rounded-xl px-4 py-2.5 text-center text-[14px] font-semibold
                        transition-colors ${
                          votingOpen
                            ? "bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent-hover"
                            : "bg-raised text-heading ring-1 ring-inset ring-line hover:ring-line-strong"
                        }`}
          >
            {votingOpen ? `Vote for ${nominee.display_name.trim().split(/\s+/)[0]}` : "View her page"}
          </Link>
        )}
      </div>
    </li>
  );
}
