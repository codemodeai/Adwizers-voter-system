"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import {
  setCategoryActive,
  updateCategory,
} from "@/app/admin/(dashboard)/categories/actions";
import {
  EMPTY_CATEGORY_FORM_STATE,
  slugify,
} from "@/app/admin/(dashboard)/categories/state";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

export type CategoryCardNominee = {
  id: string;
  display_name: string;
  business_name: string;
  is_published: boolean;
  photo_path: string | null;
};

/**
 * One category as a card (Final Plan section 5).
 *
 * The card is built around the link, because that is what this screen is for:
 * section 6 makes the per-category link the thing that actually gets shared, so
 * it gets the largest tap target on the card and everything else arranges
 * around it. The whole link block copies on click -- on the phone the client
 * uses, aiming at a small "Copy" word beside a long URL is the difference
 * between this screen working and not.
 *
 * The URL is split across two lines, domain above path. That is what keeps a
 * 50-character link inside a card without truncating it into uselessness or
 * pushing a horizontal scrollbar across the grid.
 */
export function CategoryCard({
  id,
  name,
  slug,
  isActive,
  voteUrl,
  nominees,
  photoUrls,
  first,
  last,
}: {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  voteUrl: string;
  nominees: CategoryCardNominee[];
  photoUrls: Record<string, string>;
  first: boolean;
  last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateCategory, EMPTY_CATEGORY_FORM_STATE);

  const published = nominees.filter((n) => n.is_published);
  const hidden = nominees.length - published.length;

  return (
    <li
      className={`flex flex-col overflow-hidden rounded-2xl border bg-surface transition-colors ${
        isActive ? "border-line hover:border-line-strong" : "border-dashed border-line-strong"
      }`}
    >
      {/* --- head: name, count, state -------------------------------- */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h2
            className={`truncate text-[15px] font-bold leading-tight ${
              isActive ? "text-purple-royal" : "text-ink-muted"
            }`}
            title={name}
          >
            {name}
          </h2>
          <p className="mt-1 text-[12px] text-ink-muted">
            {published.length === 0 ? (
              "No nominees yet"
            ) : (
              <>
                <span className="font-semibold text-magenta-royal">{published.length}</span> nominee
                {published.length === 1 ? "" : "s"} live
              </>
            )}
            {hidden > 0 && ` · ${hidden} hidden`}
          </p>
        </div>

        <ActiveToggle id={id} active={isActive} hasNominees={published.length > 0} />
      </div>

      {editing ? (
        <form action={action} className="px-4 pb-4 pt-3">
          <input type="hidden" name="id" value={id} />
          <SlugEditor name={name} slug={slug} />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="submit" className="px-4 py-2 text-[13px]">
              Save
            </Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-muted hover:bg-canvas"
            >
              Cancel
            </button>
          </div>

          {state.status !== "idle" && (
            <p
              role="status"
              className={`mt-2 text-[12px] font-medium ${
                state.status === "saved" ? "text-gold-champagne" : "text-magenta-dark"
              }`}
            >
              {state.message}
            </p>
          )}
        </form>
      ) : (
        <>
          {/* --- the link: the point of this screen ------------------ */}
          <div className="px-4 pt-3">
            <LinkBlock url={voteUrl} disabled={!isActive} />
          </div>

          {/* --- who is on it --------------------------------------- */}
          <div className="flex-1 px-4 pt-3">
            {nominees.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-ink-muted">
                Cards appear here as you promote applicants in this category.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {nominees.map((nominee) => (
                  <li key={nominee.id}>
                    <Link
                      href={`/admin/nominees/${nominee.id}`}
                      title={`${nominee.display_name} — ${nominee.business_name}`}
                      className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5
                                  text-[12px] font-medium ring-1 ring-inset transition-colors ${
                                    nominee.is_published
                                      ? "bg-magenta-soft text-magenta-royal ring-magenta-royal/15 hover:bg-magenta-royal hover:text-white"
                                      : "bg-neutral-100 text-neutral-500 ring-line hover:bg-purple-soft hover:text-purple-royal"
                                  }`}
                    >
                      <Thumb
                        url={nominee.photo_path ? (photoUrls[nominee.photo_path] ?? null) : null}
                        name={nominee.display_name}
                      />
                      <span className="max-w-[8.5rem] truncate">{nominee.display_name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* --- footer: the rare actions --------------------------- */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[13px] font-semibold text-magenta-royal hover:underline"
            >
              Rename
            </button>
            <ReorderButtons kind="category" id={id} first={first} last={last} label={name} />
          </div>
        </>
      )}
    </li>
  );
}

/**
 * The shareable link, as one large copy target.
 *
 * Clicking anywhere copies. The clipboard write can be refused (insecure
 * origin, denied permission), so failure falls back to telling the admin to
 * select the text rather than silently doing nothing.
 */
function LinkBlock({ url, disabled }: { url: string; disabled: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  // Split so a 50-character URL wraps predictably instead of truncating or
  // pushing the grid sideways.
  const withoutScheme = url.replace(/^https?:\/\//, "");
  const cut = withoutScheme.indexOf("/vote/");
  const host = cut === -1 ? "" : withoutScheme.slice(0, cut);
  const path = cut === -1 ? withoutScheme : withoutScheme.slice(cut);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={copy}
        title={disabled ? `${url} — this category is hidden, so the page is closed` : `Copy ${url}`}
        className={`group w-full rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition-colors ${
          disabled
            ? "bg-canvas ring-line"
            : "bg-purple-soft/60 ring-purple-royal/10 hover:bg-purple-soft hover:ring-purple-royal/25"
        }`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0">
            {host && (
              <span className="block truncate font-mono text-[11px] leading-tight text-ink-muted">
                {host}
              </span>
            )}
            <span
              className={`block break-all font-mono text-[13px] font-semibold leading-snug ${
                disabled ? "text-neutral-400 line-through" : "text-purple-royal"
              }`}
            >
              {path}
            </span>
          </span>

          <span
            className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide
                        transition-colors ${
                          state === "copied"
                            ? "bg-magenta-royal text-white"
                            : "bg-white text-magenta-royal ring-1 ring-inset ring-magenta-royal/20 group-hover:bg-magenta-royal group-hover:text-white"
                        }`}
          >
            {state === "copied" ? "Copied" : state === "failed" ? "Select" : "Copy"}
          </span>
        </span>
      </button>

      {!disabled && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-[12px] font-medium text-ink-muted underline underline-offset-2 hover:text-purple-royal"
        >
          Open the page ↗
        </a>
      )}
      {disabled && (
        <p className="text-[12px] leading-snug text-ink-muted">
          Hidden — this page is closed and the link will not open.
        </p>
      )}
    </div>
  );
}

/**
 * Name and link, with the link previewed live.
 *
 * Changing a slug breaks every poster and forwarded message already carrying
 * the old one, so the warning appears the moment the value diverges from what
 * is saved -- before the admin commits, not after.
 */
function SlugEditor({ name, slug }: { name: string; slug: string }) {
  const [nextName, setNextName] = useState(name);
  const [nextSlug, setNextSlug] = useState(slug);

  const effective = slugify(nextSlug || nextName);
  const changed = effective !== slug;

  return (
    <div className="space-y-3">
      <label className="block space-y-1.5">
        <span className="block text-[13px] font-medium text-heading">Category name</span>
        <input
          name="name"
          value={nextName}
          onChange={(event) => setNextName(event.target.value)}
          className={`${inputClass} py-2 text-[14px]`}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="block text-[13px] font-medium text-heading">Link</span>
        <input
          name="slug"
          value={nextSlug}
          onChange={(event) => setNextSlug(event.target.value)}
          className={`${inputClass} py-2 font-mono text-[13px]`}
        />
        <span className="block break-all font-mono text-[12px] text-ink-muted">
          /vote/<span className="font-semibold text-charcoal">{effective || "…"}</span>
        </span>
        {changed && (
          <span role="alert" className="block text-[12px] font-medium leading-snug text-magenta-dark">
            This changes the shareable link. Anything already sent out pointing at /vote/{slug} stops
            working.
          </span>
        )}
      </label>
    </div>
  );
}

/** Hide / show a category. Never a delete -- entries reference it. */
function ActiveToggle({
  id,
  active,
  hasNominees,
}: {
  id: number;
  active: boolean;
  hasNominees: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function apply(next: boolean) {
    startTransition(async () => {
      const result = await setCategoryActive(id, next);
      setConfirming(false);
      if (!result.ok) setError(result.error ?? "Could not change this.");
    });
  }

  function click() {
    if (pending) return;
    setError(null);
    // Hiding a category with live nominees closes a page people may already
    // hold a link to, so that direction asks first.
    if (active && hasNominees) setConfirming(true);
    else apply(!active);
  }

  if (confirming) {
    return (
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-right text-[11px] leading-tight text-ink-muted">Close this page?</span>
        <span className="inline-flex gap-1">
          <button
            type="button"
            onClick={() => apply(false)}
            disabled={pending}
            className="rounded-md bg-purple-royal px-2 py-1 text-[11px] font-semibold text-white
                       hover:bg-purple-deep disabled:opacity-60"
          >
            {pending ? "…" : "Hide"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-ink-muted
                       ring-1 ring-inset ring-line hover:bg-canvas"
          >
            No
          </button>
        </span>
      </span>
    );
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={click}
        disabled={pending}
        title={active ? "Hide this category" : "Show this category"}
        className={
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 " +
          "text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset " +
          "transition-colors disabled:opacity-60 " +
          (active
            ? "bg-purple-soft text-purple-royal ring-purple-royal/15 hover:bg-purple-royal hover:text-white"
            : "bg-neutral-100 text-neutral-500 ring-line hover:bg-purple-soft hover:text-purple-royal")
        }
      >
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${active ? "bg-magenta-royal" : "bg-neutral-400"}`}
        />
        {pending ? "…" : active ? "Open" : "Hidden"}
      </button>
      {error && (
        <span role="alert" className="max-w-[9rem] text-right text-[11px] font-medium text-magenta-dark">
          {error}
        </span>
      )}
    </span>
  );
}

function Thumb({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // Plain <img>: these are 20px chips behind short-lived signed URLs, where
    // next/image's optimiser adds a round trip and nothing else.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" aria-hidden="true" className="size-5 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-5 items-center justify-center rounded-full bg-white/60
                 text-[9px] font-bold text-purple-royal"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
