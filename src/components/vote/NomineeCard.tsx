import Image from "next/image";

import type { PublicNominee } from "@/lib/nominees";

/**
 * A nominee's card on her category's voting page (Final Plan section 6):
 * photo, name, business name, short bio, and a checkbox.
 *
 * The checkbox is present and disabled rather than absent, because the layout
 * it sits in is the one voting will actually use -- building the card without
 * it would mean redrawing this page when the ballot opens, and the cards are
 * being shared with nominees now.
 */
export function NomineeCard({
  nominee,
  photoUrl,
}: {
  nominee: PublicNominee;
  photoUrl: string | null;
}) {
  const links = [
    { href: nominee.social_instagram, label: "Instagram" },
    { href: nominee.social_facebook, label: "Facebook" },
    { href: nominee.social_website, label: "Website" },
  ].filter((link): link is { href: string; label: string } => Boolean(link.href));

  return (
    <li
      className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface/70
                 transition-colors hover:border-line-strong"
    >
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
        <div className="flex items-start justify-between gap-3">
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

          {/* Inert until the ballot opens; `disabled` and the title say why. */}
          <input
            type="checkbox"
            disabled
            aria-label={`Vote for ${nominee.display_name} (voting has not opened)`}
            title="Voting has not opened yet"
            className="mt-0.5 size-5 shrink-0 cursor-not-allowed rounded border-line-strong
                       bg-transparent opacity-45"
          />
        </div>

        {nominee.bio && (
          <p className="line-clamp-4 text-[13px] leading-relaxed text-ink-muted">{nominee.bio}</p>
        )}

        {links.length > 0 && (
          <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1.5 text-[12px]">
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
    </li>
  );
}
