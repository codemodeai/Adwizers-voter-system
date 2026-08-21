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
import { CopyLink } from "@/components/admin/CopyLink";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

export type CategoryRowNominee = {
  id: string;
  display_name: string;
  business_name: string;
  is_published: boolean;
  photo_path: string | null;
};

/**
 * One category on the Categories screen: its shareable link, the nominee cards
 * that are on it, and the edit controls.
 *
 * The row is closed by default and opens into an editor, because the common
 * task here is "copy the link for this category" and the rare one is "rename
 * it" -- so renaming does not get to crowd out copying.
 */
export function CategoryRow({
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
  nominees: CategoryRowNominee[];
  photoUrls: Record<string, string>;
  first: boolean;
  last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateCategory, EMPTY_CATEGORY_FORM_STATE);

  const published = nominees.filter((n) => n.is_published);

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
        <ReorderButtons kind="category" id={id} first={first} last={last} label={name} />

        <div className="min-w-[14rem] flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-purple-royal">{name}</h3>
            {!isActive && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 ring-1 ring-inset ring-line">
                Hidden
              </span>
            )}
            <span className="text-[12px] text-ink-muted">
              {published.length} nominee{published.length === 1 ? "" : "s"} live
              {nominees.length !== published.length &&
                ` · ${nominees.length - published.length} hidden`}
            </span>
          </div>

          <CopyLink url={voteUrl} disabled={!isActive} />

          {nominees.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pt-0.5">
              {nominees.map((nominee) => (
                <li key={nominee.id}>
                  <Link
                    href={`/admin/nominees/${nominee.id}`}
                    title={nominee.business_name}
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
                    <span className="max-w-[9rem] truncate">{nominee.display_name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <ActiveToggle id={id} active={isActive} hasNominees={published.length > 0} />
          <button
            type="button"
            onClick={() => setEditing((open) => !open)}
            className="text-[13px] font-semibold text-magenta-royal hover:underline"
          >
            {editing ? "Cancel" : "Rename"}
          </button>
        </div>
      </div>

      {editing && (
        <form action={action} className="mt-4 rounded-lg bg-canvas p-4">
          <input type="hidden" name="id" value={id} />
          <SlugEditor name={name} slug={slug} />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="submit" className="px-5 py-2">
              Save
            </Button>
            {state.status !== "idle" && (
              <p
                role="status"
                className={`text-[13px] font-medium ${
                  state.status === "saved" ? "text-gold-champagne" : "text-magenta-dark"
                }`}
              >
                {state.message}
              </p>
            )}
          </div>
        </form>
      )}
    </li>
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
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1.5">
        <span className="block text-sm font-medium text-heading">Category name</span>
        <input
          name="name"
          value={nextName}
          onChange={(event) => setNextName(event.target.value)}
          className={inputClass}
        />
      </label>

      <label className="space-y-1.5">
        <span className="block text-sm font-medium text-heading">Link</span>
        <input
          name="slug"
          value={nextSlug}
          onChange={(event) => setNextSlug(event.target.value)}
          className={inputClass}
        />
        <span className="block text-[13px] text-ink-muted">
          /vote/<span className="font-medium text-charcoal">{effective || "…"}</span>
        </span>
        {changed && (
          <span role="alert" className="block text-[13px] font-medium text-magenta-dark">
            This changes the shareable link. Anything already sent out pointing at /vote/{slug} will
            stop working.
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
      <span className="flex flex-col items-end gap-1">
        <span className="text-right text-[11px] leading-snug text-ink-muted">
          Closes this voting page.
        </span>
        <span className="inline-flex gap-1.5">
          <button
            type="button"
            onClick={() => apply(false)}
            disabled={pending}
            className="rounded-md bg-purple-royal px-2.5 py-1.5 text-[12px] font-semibold
                       text-white hover:bg-purple-deep disabled:opacity-60"
          >
            {pending ? "Hiding…" : "Hide it"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-ink-muted
                       ring-1 ring-inset ring-line hover:bg-canvas"
          >
            Cancel
          </button>
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={click}
        disabled={pending}
        title={active ? "Hide this category" : "Show this category"}
        className={
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 " +
          "text-[12px] font-semibold ring-1 ring-inset transition-colors disabled:opacity-60 " +
          (active
            ? "bg-purple-soft text-purple-royal ring-purple-royal/15 hover:bg-purple-royal hover:text-white"
            : "bg-neutral-100 text-neutral-500 ring-line hover:bg-purple-soft hover:text-purple-royal")
        }
      >
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${active ? "bg-purple-royal" : "bg-neutral-400"}`}
        />
        {pending ? "Saving…" : active ? "Open" : "Hidden"}
      </button>
      {error && (
        <span role="alert" className="text-[11px] font-medium text-magenta-dark">
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
