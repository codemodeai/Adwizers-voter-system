"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import {
  setCategoryActive,
  updateCategory,
} from "@/app/admin/(dashboard)/categories/actions";
import { EMPTY_CATEGORY_FORM_STATE } from "@/app/admin/(dashboard)/categories/state";
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
  code: string | null;
};

/**
 * One category as a full-width box (Final Plan section 5).
 *
 * The category is the container and the nominees are cards inside it. A
 * category has no public page or link of its own -- voting happens only on
 * each nominee's personal link, sent from the Nominees screen.
 */
export function CategoryCard({
  id,
  name,
  slug,
  isActive,
  nominees,
  photoUrls,
  first,
  last,
}: {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
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
                  nominee{published.length === 1 ? "" : "s"} live
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
            <NameEditor name={name} slug={slug} />
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
        ) : null}
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
          {nominee.code && (
            <span className="block font-mono text-[10px] font-semibold tracking-wide text-ink-muted">
              {nominee.code}
            </span>
          )}
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
 * Renaming a category. The internal slug travels unchanged as a hidden field:
 * there are no public category links any more, so nothing about a rename
 * should touch it.
 */
function NameEditor({ name, slug }: { name: string; slug: string }) {
  return (
    <label className="block max-w-md space-y-1.5">
      <span className="block text-[13px] font-medium text-heading">Category name</span>
      <input name="name" defaultValue={name} className={`${inputClass} py-2 text-[14px]`} />
      <input type="hidden" name="slug" value={slug} />
    </label>
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
