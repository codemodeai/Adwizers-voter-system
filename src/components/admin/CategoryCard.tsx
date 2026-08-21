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
  area_location: string | null;
  is_published: boolean;
  photo_path: string | null;
};

/**
 * One category as a full-width box (Final Plan section 5).
 *
 * The category is the container and the nominees are cards inside it, because
 * that is the actual structure of the thing: section 6 says a nominee has no
 * link of her own and exists only as a card on her category's page. The screen
 * mirrors that -- one box per shared link, holding the cards that link leads
 * to, so what an admin sees here is what a voter will see there.
 *
 * The link sits in the box header rather than beside each nominee, for the same
 * reason: it belongs to the category, never to a person.
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
      className={`overflow-hidden rounded-2xl border bg-surface ${
        isActive ? "border-line" : "border-dashed border-line-strong bg-canvas/40"
      }`}
    >
      {/* ---- box header: name, link, controls ---------------------- */}
      <div className="border-b border-line px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2
                className={`text-lg font-bold leading-tight tracking-tight sm:text-xl ${
                  isActive ? "text-purple-royal" : "text-ink-muted"
                }`}
              >
                {name}
              </h2>
              <ActiveToggle id={id} active={isActive} hasNominees={published.length > 0} />
            </div>

            <p className="mt-1 text-[13px] text-ink-muted">
              {published.length === 0 ? (
                "No nominees yet"
              ) : (
                <>
                  <span className="font-semibold text-magenta-royal">{published.length}</span>{" "}
                  nominee{published.length === 1 ? "" : "s"} live on this page
                </>
              )}
              {hidden > 0 && ` · ${hidden} hidden`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing((open) => !open)}
              className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-magenta-royal
                         transition-colors hover:bg-magenta-soft"
            >
              {editing ? "Cancel" : "Rename"}
            </button>
            <ReorderButtons kind="category" id={id} first={first} last={last} label={name} />
          </div>
        </div>

        {editing ? (
          <form action={action} className="mt-4 rounded-xl bg-canvas p-4">
            <input type="hidden" name="id" value={id} />
            <SlugEditor name={name} slug={slug} />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="submit" className="px-5 py-2 text-[13px]">
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
        ) : (
          <div className="mt-3.5">
            <LinkBlock url={voteUrl} disabled={!isActive} />
          </div>
        )}
      </div>

      {/* ---- box body: the nominee cards --------------------------- */}
      <div className="px-4 py-4 sm:px-5">
        {nominees.length === 0 ? (
          <p className="py-2 text-[13px] text-ink-muted">
            No nominee cards yet. Promote an applicant in this category from{" "}
            <Link
              href="/admin/applicants"
              className="font-medium underline underline-offset-2 hover:text-purple-royal"
            >
              Applicants
            </Link>{" "}
            and her card appears here.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {nominees.map((nominee) => (
              <NomineeMiniCard
                key={nominee.id}
                nominee={nominee}
                photoUrl={nominee.photo_path ? (photoUrls[nominee.photo_path] ?? null) : null}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * A nominee inside her category box -- the same three facts her public card
 * carries (photo, name, business), so this screen previews the voting page
 * rather than describing it.
 */
function NomineeMiniCard({
  nominee,
  photoUrl,
}: {
  nominee: CategoryCardNominee;
  photoUrl: string | null;
}) {
  return (
    <li>
      <Link
        href={`/admin/nominees/${nominee.id}`}
        className={`flex h-full items-center gap-3 rounded-xl p-2.5 ring-1 ring-inset
                    transition-colors ${
                      nominee.is_published
                        ? "bg-magenta-soft/50 ring-magenta-royal/15 hover:bg-magenta-soft hover:ring-magenta-royal/35"
                        : "bg-canvas ring-line hover:bg-purple-soft/50"
                    }`}
      >
        {photoUrl ? (
          // Plain <img>: a 48px thumbnail behind a short-lived signed URL, where
          // next/image's optimiser adds a round trip and nothing else.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            aria-hidden="true"
            className="size-12 shrink-0 rounded-lg object-cover ring-1 ring-line"
          />
        ) : (
          <span
            aria-hidden="true"
            title="No photo yet"
            className="flex size-12 shrink-0 items-center justify-center rounded-lg
                       bg-white text-base font-bold text-purple-royal ring-1 ring-line"
          >
            {nominee.display_name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-purple-royal">
            {nominee.display_name}
          </span>
          <span className="block truncate text-[12px] text-ink-muted">
            {nominee.business_name}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${
                nominee.is_published ? "bg-magenta-royal" : "bg-neutral-400"
              }`}
            />
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide ${
                nominee.is_published ? "text-magenta-royal" : "text-ink-muted"
              }`}
            >
              {nominee.is_published ? "Live" : "Hidden"}
            </span>
            {!nominee.photo_path && (
              <span className="text-[11px] font-medium text-magenta-dark">· no photo</span>
            )}
          </span>
        </span>
      </Link>
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={copy}
        title={disabled ? `${url} — this category is hidden, so the page is closed` : `Copy ${url}`}
        className={`group min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-left ring-1 ring-inset
                    transition-colors sm:max-w-lg ${
                      disabled
                        ? "bg-canvas ring-line"
                        : "bg-purple-soft/60 ring-purple-royal/10 hover:bg-purple-soft hover:ring-purple-royal/25"
                    }`}
      >
        <span className="flex items-center justify-between gap-3">
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
            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase
                        tracking-wide transition-colors ${
                          state === "copied"
                            ? "bg-magenta-royal text-white"
                            : "bg-white text-magenta-royal ring-1 ring-inset ring-magenta-royal/20 group-hover:bg-magenta-royal group-hover:text-white"
                        }`}
          >
            {state === "copied" ? "Copied" : state === "failed" ? "Select" : "Copy"}
          </span>
        </span>
      </button>

      {disabled ? (
        <p className="text-[12px] leading-snug text-ink-muted">
          Hidden — this page is closed and the link will not open.
        </p>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] font-medium text-ink-muted underline underline-offset-2
                     hover:text-purple-royal"
        >
          Open the page ↗
        </a>
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
    <div className="grid gap-3 sm:grid-cols-2">
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
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[11px] text-ink-muted">Close this page?</span>
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
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
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
        <span role="alert" className="text-[11px] font-medium text-magenta-dark">
          {error}
        </span>
      )}
    </span>
  );
}
