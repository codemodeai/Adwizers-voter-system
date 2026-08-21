"use client";

import { useState, useTransition } from "react";

import { setVotingPaused } from "@/app/admin/(dashboard)/voting/actions";

/**
 * Manual pause / resume (Final Plan section 10).
 *
 * Independent of the schedule, and the copy says so: pausing is for handling a
 * problem mid-window, and it must be obvious that it does not move the dates.
 *
 * Pausing asks for confirmation while voting is genuinely live, because it
 * stops real people mid-vote. Resuming does not -- it only ever restores what
 * the schedule already said.
 */
export function PauseVotingButton({
  paused,
  live,
}: {
  paused: boolean;
  /** Whether the window is currently open, i.e. whether this has any immediate
   *  effect on voters right now. */
  live: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function apply(next: boolean) {
    startTransition(async () => {
      const result = await setVotingPaused(next);
      setConfirming(false);
      if (!result.ok) setError(result.error ?? "Could not change this.");
    });
  }

  function click() {
    if (pending) return;
    setError(null);
    if (!paused && live) setConfirming(true);
    else apply(!paused);
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-[13px] font-medium text-charcoal">
          Voting is live right now. Pause it for everyone?
        </p>
        <button
          type="button"
          onClick={() => apply(true)}
          disabled={pending}
          className="rounded-lg bg-purple-royal px-4 py-2 text-[13px] font-semibold text-white
                     transition-colors hover:bg-purple-deep disabled:opacity-60"
        >
          {pending ? "Pausing…" : "Pause voting"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-muted
                     ring-1 ring-inset ring-line hover:bg-canvas"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={click}
        disabled={pending}
        className={
          "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold " +
          "transition-colors disabled:opacity-60 " +
          (paused
            ? "bg-magenta-royal text-white hover:bg-magenta-dark"
            : "bg-surface text-purple-royal ring-1 ring-inset ring-line hover:bg-purple-soft")
        }
      >
        {pending ? "Saving…" : paused ? "Resume voting" : "Pause voting"}
      </button>

      <p className="text-[13px] text-ink-muted">
        {paused
          ? "Paused. The dates below are untouched — resuming puts them straight back in force."
          : "Stops voting immediately without changing the schedule."}
      </p>

      {error && (
        <p role="alert" className="text-[13px] font-medium text-magenta-dark">
          {error}
        </p>
      )}
    </div>
  );
}
