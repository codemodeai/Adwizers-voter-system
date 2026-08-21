"use client";

import { useState, useTransition } from "react";

import { setVotingStatus } from "@/app/admin/(dashboard)/voting/actions";
import type { VotingStatus } from "@/lib/voting";

type Action = {
  to: VotingStatus;
  label: string;
  tone: "primary" | "quiet" | "danger";
  /** Confirmation copy, or null to act on the first click. */
  confirm: string | null;
};

/**
 * Which moves are offered from each state, and which of them need asking
 * about first.
 *
 * Opening and stopping both change what the public sees immediately, so both
 * confirm. Pause and resume do not: they are the controls you reach for when
 * something is going wrong and hesitating costs more than it saves.
 */
const MOVES: Record<VotingStatus, Action[]> = {
  not_started: [
    {
      to: "open",
      label: "Start voting",
      tone: "primary",
      confirm: "Open voting on every category page now?",
    },
  ],
  open: [
    { to: "paused", label: "Pause voting", tone: "quiet", confirm: null },
    {
      to: "stopped",
      label: "Stop voting",
      tone: "danger",
      confirm: "Stop voting for good? Every category page will say voting has closed.",
    },
  ],
  paused: [
    { to: "open", label: "Resume voting", tone: "primary", confirm: null },
    {
      to: "stopped",
      label: "Stop voting",
      tone: "danger",
      confirm: "Stop voting for good? Every category page will say voting has closed.",
    },
  ],
  stopped: [
    {
      to: "open",
      label: "Reopen voting",
      tone: "primary",
      confirm: "Voting has been stopped. Reopen it and start accepting votes again?",
    },
  ],
};

const TONES: Record<Action["tone"], string> = {
  primary: "bg-magenta-royal text-white hover:bg-magenta-dark",
  quiet: "bg-surface text-purple-royal ring-1 ring-inset ring-line hover:bg-purple-soft",
  danger: "bg-purple-royal text-white hover:bg-purple-deep",
};

/**
 * The global voting switch (Final Plan section 10, manual variant).
 *
 * Shows only the moves that are legal from where things stand, rather than
 * four buttons of which two are meaningless -- the control teaches the state
 * machine instead of documenting it.
 */
export function VotingSwitch({ status }: { status: VotingStatus }) {
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<Action | null>(null);
  const [pending, startTransition] = useTransition();

  function apply(to: VotingStatus) {
    startTransition(async () => {
      const result = await setVotingStatus(to);
      setAsking(null);
      if (!result.ok) setError(result.error ?? "Could not change this.");
    });
  }

  function click(action: Action) {
    if (pending) return;
    setError(null);
    if (action.confirm) setAsking(action);
    else apply(action.to);
  }

  if (asking) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-[13px] font-medium text-charcoal">{asking.confirm}</p>
        <button
          type="button"
          onClick={() => apply(asking.to)}
          disabled={pending}
          className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors
                      disabled:opacity-60 ${TONES[asking.tone]}`}
        >
          {pending ? "Working…" : asking.label}
        </button>
        <button
          type="button"
          onClick={() => setAsking(null)}
          disabled={pending}
          className="rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-muted
                     ring-1 ring-inset ring-line hover:bg-canvas"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2.5">
        {MOVES[status].map((action) => (
          <button
            key={action.to + action.label}
            type="button"
            onClick={() => click(action)}
            disabled={pending}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors
                        disabled:opacity-60 ${TONES[action.tone]}`}
          >
            {pending ? "Working…" : action.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-medium text-magenta-dark">
          {error}
        </p>
      )}
    </div>
  );
}
