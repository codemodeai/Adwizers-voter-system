"use client";

import { useState, useTransition } from "react";

import {
  setAllCategoriesPaused,
  setCategoryVotingPaused,
} from "@/app/admin/(dashboard)/voting/actions";

/**
 * Pause / resume voting for one category, while the rest keep running.
 *
 * Neither direction confirms. This is the control an admin reaches for when one
 * category is going wrong mid-vote, and it is fully reversible -- no vote is
 * lost by pausing, and resuming restores things exactly. A confirmation here
 * would cost more than it protects.
 */
export function CategoryVotingToggle({
  id,
  paused,
  /** Whether global voting is open. When it is not, this switch is armed for
   *  later rather than doing anything now, and says so. */
  globallyOpen,
}: {
  id: number;
  paused: boolean;
  globallyOpen: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await setCategoryVotingPaused(id, !paused);
      if (!result.ok) setError(result.error ?? "Could not change this.");
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={
          globallyOpen
            ? paused
              ? "Resume voting for this category"
              : "Pause voting for this category only"
            : paused
              ? "Will stay paused when voting starts"
              : "Will accept votes when voting starts"
        }
        className={
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 " +
          "text-[12px] font-semibold ring-1 ring-inset transition-colors disabled:opacity-60 " +
          (paused
            ? "bg-gold-soft text-gold-champagne ring-gold-champagne/25 hover:bg-gold-champagne hover:text-white"
            : "bg-surface text-purple-royal ring-line hover:bg-purple-soft")
        }
      >
        {pending ? "…" : paused ? "Resume" : "Pause"}
      </button>
      {error && (
        <span role="alert" className="max-w-[12rem] text-right text-[11px] font-medium text-magenta-dark">
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * Pause or resume every category at once.
 *
 * Exists because the per-category switches make it necessary: after holding
 * four categories individually, putting them all back should not be fourteen
 * clicks.
 */
export function AllCategoriesToggle({ anyPaused }: { anyPaused: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await setAllCategoriesPaused(!anyPaused);
      if (!result.ok) setError(result.error ?? "Could not change this.");
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={apply}
        disabled={pending}
        className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-magenta-royal
                   transition-colors hover:bg-magenta-soft disabled:opacity-60"
      >
        {pending ? "Working…" : anyPaused ? "Resume all categories" : "Pause all categories"}
      </button>
      {error && (
        <span role="alert" className="text-[11px] font-medium text-magenta-dark">
          {error}
        </span>
      )}
    </span>
  );
}
