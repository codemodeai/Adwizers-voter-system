"use client";

import { useState, useTransition } from "react";

import { setPaymentReceived } from "@/app/admin/(dashboard)/applicants/actions";
import type { ApplicantStatus } from "@/lib/types";

/**
 * Switch for marking payment received in place -- from the applicants list or
 * the top of the review screen.
 *
 * Flips optimistically so the row responds immediately, and rolls back if the
 * server rejects it. A promoted applicant is locked on: payment is implied by
 * the nominee record, so it must not be undone from a stray click.
 */
export function PaymentToggle({
  id,
  status,
  size = "sm",
  showLabel = false,
}: {
  id: string;
  status: ApplicantStatus;
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  const initial = status === "payment_received" || status === "promoted";
  const locked = status === "promoted";

  const [paid, setPaid] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Server state wins whenever the row re-renders with a different status.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setPaid(initial);
  }

  function toggle() {
    if (locked || pending) return;
    const next = !paid;
    setPaid(next);
    setError(null);

    startTransition(async () => {
      const result = await setPaymentReceived(id, next);
      if (!result.ok) {
        setPaid(!next);
        setError(result.error ?? "Could not update payment.");
      }
    });
  }

  const track = size === "md" ? "h-6 w-11" : "h-5 w-9";
  const knob = size === "md" ? "size-5" : "size-4";
  const travel = size === "md" ? "translate-x-5" : "translate-x-4";

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={paid}
        aria-label={`Payment received for this applicant`}
        onClick={toggle}
        disabled={locked || pending}
        title={
          locked
            ? "Promoted to nominee — payment can no longer be changed here"
            : paid
              ? "Payment received. Click to undo."
              : "Mark payment received"
        }
        className={
          `relative inline-flex shrink-0 items-center rounded-full transition-colors ${track} ` +
          (paid ? "bg-magenta-royal" : "bg-neutral-300") +
          (locked ? " cursor-not-allowed opacity-60" : " cursor-pointer") +
          (pending ? " opacity-70" : "")
        }
      >
        <span
          className={
            `inline-block ${knob} translate-x-0.5 rounded-full bg-white shadow-sm ` +
            `transition-transform ${paid ? travel : ""}`
          }
        />
      </button>

      {showLabel && (
        <span
          className={
            "text-[13px] font-medium " + (paid ? "text-magenta-royal" : "text-ink-muted")
          }
        >
          {locked ? "Paid (promoted)" : paid ? "Payment received" : "Mark payment"}
        </span>
      )}

      {error && (
        <span role="alert" className="text-[12px] font-medium text-magenta-dark">
          {error}
        </span>
      )}
    </div>
  );
}
