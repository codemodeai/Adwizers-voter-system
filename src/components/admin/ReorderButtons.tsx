"use client";

import { useState, useTransition } from "react";

import { moveCategory } from "@/app/admin/(dashboard)/categories/actions";
import { moveNominee } from "@/app/admin/(dashboard)/nominees/actions";

/**
 * Up / down arrows for anything that has a shared order -- nominee cards within
 * a category, and the categories themselves.
 *
 * Two buttons rather than drag-and-drop on purpose: this is fourteen categories
 * with a handful of cards each, it has to work on the phone the client actually
 * uses, and a keyboard user gets it for free.
 *
 * The action is chosen here from `kind` rather than passed in, because a server
 * component cannot hand a client component a closure -- only a server action
 * reference itself crosses that boundary.
 */
export function ReorderButtons({
  kind,
  id,
  first,
  last,
  label,
}: {
  kind: "nominee" | "category";
  id: string | number;
  first: boolean;
  last: boolean;
  /** Names the thing being moved, for screen readers. */
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result =
        kind === "nominee"
          ? await moveNominee(String(id), direction)
          : await moveCategory(Number(id), direction);
      if (!result.ok) setError(result.error ?? "Could not reorder.");
    });
  }

  const base =
    "flex size-7 items-center justify-center rounded-md ring-1 ring-inset ring-line " +
    "text-purple-royal transition-colors hover:bg-purple-soft " +
    "disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent";

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span className="inline-flex gap-1">
        <button
          type="button"
          onClick={() => move("up")}
          disabled={first || pending}
          aria-label={`Move ${label} up`}
          className={base}
        >
          <Chevron up />
        </button>
        <button
          type="button"
          onClick={() => move("down")}
          disabled={last || pending}
          aria-label={`Move ${label} down`}
          className={base}
        >
          <Chevron />
        </button>
      </span>
      {error && (
        <span role="alert" className="text-[11px] font-medium text-magenta-dark">
          {error}
        </span>
      )}
    </span>
  );
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`size-3.5 ${up ? "" : "rotate-180"}`}
    >
      <path
        d="m5 12.5 5-5 5 5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
