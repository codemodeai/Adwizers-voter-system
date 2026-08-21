"use client";

import { useState, useTransition } from "react";

import { promoteToNominee } from "@/app/admin/(dashboard)/applicants/actions";
import type { ApplicantStatus, FormType } from "@/lib/types";

/**
 * "Promote to Nominee" (Final Plan section 4).
 *
 * Only becomes available once payment is marked received, which is the order
 * the plan lays out -- so the button itself teaches the workflow rather than
 * failing after the fact.
 *
 * It now does three irreversible-feeling things in one click: creates her
 * public profile, puts her card live on the category page, and emails her. So
 * it asks first. The confirmation is inline rather than a `confirm()` dialog --
 * a native dialog would block the page, and this one can say exactly what is
 * about to happen.
 */
export function PromoteButton({
  id,
  status,
  size = "sm",
  formType = "award",
}: {
  id: string;
  status: ApplicantStatus;
  size?: "sm" | "md";
  /** Nominees come out of the awards. A stall booking has nowhere to be
   *  promoted to, so the button simply is not there. */
  formType?: FormType;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const promoted = status === "promoted";
  const ready = status === "payment_received";

  function promote() {
    if (!ready || pending) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await promoteToNominee(id);
      setConfirming(false);
      if (!result.ok) setError(result.error ?? "Could not promote.");
      else if (result.notice) setNotice(result.notice);
    });
  }

  const pad = size === "md" ? "px-4 py-2.5 text-sm" : "px-2.5 py-1.5 text-[12px]";

  // Nominees come out of the awards. A stall booking has nowhere to be
  // promoted to, so the button simply is not there.
  if (formType === "stall") return null;

  if (promoted) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-magenta-soft
                      font-semibold text-magenta-royal ring-1 ring-inset ring-magenta-royal/20 ${pad}`}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-3.5">
            <path
              d="m4.5 10.5 3.5 3.5 7.5-8"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Nominee
        </span>
        {notice && (
          <span role="status" className="max-w-[15rem] text-right text-[11px] text-ink-muted">
            {notice}
          </span>
        )}
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <span className="text-right text-[11px] leading-snug text-ink-muted">
          Publishes her card and emails her.
        </span>
        <span className="inline-flex gap-1.5">
          <button
            type="button"
            onClick={promote}
            disabled={pending}
            className={`whitespace-nowrap rounded-md bg-purple-royal font-semibold text-white
                        transition-colors hover:bg-purple-deep disabled:opacity-60 ${pad}`}
          >
            {pending ? "Promoting…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className={`whitespace-nowrap rounded-md font-semibold text-ink-muted ring-1
                        ring-inset ring-line transition-colors hover:bg-canvas ${pad}`}
          >
            Cancel
          </button>
        </span>
        {error && (
          <span role="alert" className="max-w-[15rem] text-right text-[11px] font-medium text-magenta-dark">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={!ready || pending}
        title={ready ? "Promote to Nominee" : "Mark payment received first"}
        className={
          `whitespace-nowrap rounded-md font-semibold transition-colors ${pad} ` +
          (ready
            ? "bg-purple-royal text-white hover:bg-purple-deep"
            : "cursor-not-allowed bg-neutral-100 text-neutral-400 ring-1 ring-inset ring-line")
        }
      >
        Promote
      </button>
      {error && (
        <span role="alert" className="max-w-[15rem] text-right text-[11px] font-medium text-magenta-dark">
          {error}
        </span>
      )}
    </span>
  );
}
