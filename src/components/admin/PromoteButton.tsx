"use client";

import { useState, useTransition } from "react";

import { promoteToNominee } from "@/app/admin/(dashboard)/applicants/actions";
import type { ApplicantStatus } from "@/lib/types";

/**
 * "Promote to Nominee" (Final Plan section 4).
 *
 * Only becomes available once payment is marked received, which is the order
 * the plan lays out -- so the button itself teaches the workflow rather than
 * failing after the fact.
 */
export function PromoteButton({
  id,
  status,
  size = "sm",
}: {
  id: string;
  status: ApplicantStatus;
  size?: "sm" | "md";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const promoted = status === "promoted";
  const ready = status === "payment_received";

  function promote() {
    if (!ready || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await promoteToNominee(id);
      if (!result.ok) setError(result.error ?? "Could not promote.");
    });
  }

  const pad = size === "md" ? "px-4 py-2.5 text-sm" : "px-2.5 py-1.5 text-[12px]";

  if (promoted) {
    return (
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
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={promote}
        disabled={!ready || pending}
        title={ready ? "Promote to Nominee" : "Mark payment received first"}
        className={
          `whitespace-nowrap rounded-md font-semibold transition-colors ${pad} ` +
          (ready
            ? "bg-purple-royal text-white hover:bg-purple-deep"
            : "cursor-not-allowed bg-neutral-100 text-neutral-400 ring-1 ring-inset ring-line")
        }
      >
        {pending ? "Promoting…" : "Promote"}
      </button>
      {error && (
        <span role="alert" className="text-[11px] font-medium text-magenta-dark">
          {error}
        </span>
      )}
    </span>
  );
}
