"use client";

import { useState, useTransition } from "react";

import { resendNomineeEmail } from "@/app/admin/(dashboard)/nominees/actions";
import type { NotifyState } from "@/lib/types";

/**
 * Whether this nominee has actually been told (Final Plan section 3), and a way
 * to fix it when she has not.
 *
 * Promotion never fails because an email failed, which is the right trade --
 * but it means "promoted" and "notified" can disagree, and that disagreement
 * has to be visible somewhere. This is that somewhere: a badge that states the
 * outcome, plus a Send button on anything that did not get through.
 */
export function NotifyBadge({
  id,
  state,
  error,
  sentAt,
  showAction = true,
}: {
  id: string;
  state: NotifyState;
  error?: string | null;
  sentAt?: string | null;
  showAction?: boolean;
}) {
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    if (pending) return;
    setResult(null);
    setFailed(false);
    startTransition(async () => {
      const outcome = await resendNomineeEmail(id);
      setFailed(!outcome.ok);
      setResult(outcome.ok ? (outcome.notice ?? "Email sent.") : (outcome.error ?? "Failed."));
    });
  }

  const badge =
    state === "sent"
      ? {
          className: "bg-gold-soft text-gold-champagne ring-gold-champagne/25",
          label: "Emailed",
        }
      : state === "failed"
        ? { className: "bg-magenta-soft text-magenta-dark ring-magenta-royal/20", label: "Not sent" }
        : { className: "bg-neutral-100 text-neutral-500 ring-line", label: "No email" };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span
        title={
          state === "sent"
            ? sentAt
              ? `Sent ${new Date(sentAt).toLocaleString("en-IN")}`
              : "Sent"
            : (error ?? "No email has been sent for this nominee")
        }
        className={`inline-flex items-center whitespace-nowrap rounded-md px-2.5 py-1.5
                    text-[12px] font-semibold ring-1 ring-inset ${badge.className}`}
      >
        {badge.label}
      </span>

      {showAction && state !== "sent" && (
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="text-[11px] font-semibold text-magenta-royal underline underline-offset-2
                     hover:text-magenta-dark disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send now"}
        </button>
      )}

      {result && (
        <span
          role="status"
          className={`max-w-[16rem] text-[11px] font-medium ${
            failed ? "text-magenta-dark" : "text-gold-champagne"
          }`}
        >
          {result}
        </span>
      )}
    </span>
  );
}
