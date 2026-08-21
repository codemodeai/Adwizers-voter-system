"use client";

import Image from "next/image";

import type { PublicNominee } from "@/lib/nominees";

/**
 * A nominee's card on her category's voting page (Final Plan section 6):
 * photo, name, business name, short bio, and a checkbox.
 *
 * When voting is open the whole card is the checkbox -- a real label wrapping a
 * real input, so it stays keyboard-reachable and screen-reader-correct while
 * giving a thumb a card-sized target instead of a 20px square. When voting is
 * not open the same card renders inert, so the layout a voter will use is the
 * layout she is already looking at.
 */
export function NomineeCard({
  nominee,
  photoUrl,
  selectable = false,
  selected = false,
  onToggle,
}: {
  nominee: PublicNominee;
  photoUrl: string | null;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const links = [
    { href: nominee.social_instagram, label: "Instagram" },
    { href: nominee.social_facebook, label: "Facebook" },
    { href: nominee.social_website, label: "Website" },
  ].filter((link): link is { href: string; label: string } => Boolean(link.href));

  const body = (
    <>
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

        {selectable && selected && (
          <span
            aria-hidden="true"
            className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center
                       rounded-full bg-accent text-white shadow-lg"
          >
            <svg viewBox="0 0 20 20" fill="none" className="size-4">
              <path
                d="m4.5 10.5 3.5 3.5 7.5-8"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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

          {selectable ? (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle?.()}
              aria-label={`Vote for ${nominee.display_name} of ${nominee.business_name}`}
              className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-line-strong
                         accent-accent"
            />
          ) : (
            <input
              type="checkbox"
              disabled
              aria-label={`Vote for ${nominee.display_name} (voting is not open)`}
              title="Voting is not open"
              className="mt-0.5 size-5 shrink-0 cursor-not-allowed rounded border-line-strong
                         bg-transparent opacity-45"
            />
          )}
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
                // Inside a label, a link click would otherwise toggle the card.
                onClick={(event) => event.stopPropagation()}
                className="font-medium text-ink-muted underline underline-offset-2 hover:text-accent"
              >
                {link.label}
              </a>
            ))}
          </p>
        )}
      </div>
    </>
  );

  const shell =
    "flex flex-col overflow-hidden rounded-2xl border bg-surface/70 transition-colors " +
    (selectable
      ? selected
        ? "cursor-pointer border-accent ring-2 ring-accent/35"
        : "cursor-pointer border-line hover:border-line-strong"
      : "border-line");

  if (!selectable) {
    return <li className={shell}>{body}</li>;
  }

  return (
    <li>
      <label className={`h-full ${shell}`}>{body}</label>
    </li>
  );
}
