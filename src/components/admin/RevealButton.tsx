"use client";

import { useState, useTransition } from "react";

import {
  publishResults,
  unpublishResults,
} from "@/app/admin/(dashboard)/results/actions";

/**
 * Reveal / take down the winner page (Final Plan section 11).
 *
 * Both directions confirm. Revealing publishes names the whole community will
 * see; taking it down retracts something already announced. Neither is a
 * click you should be able to make by brushing the screen.
 */
export function RevealButton({
  published,
  canPublish,
  reason,
}: {
  published: boolean;
  /** Whether revealing is currently allowed -- voting must be stopped first. */
  canPublish: boolean;
  /** Why it is not allowed, shown in place of the button. */
  reason?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(publish: boolean) {
    startTransition(async () => {
      const result = publish ? await publishResults() : await unpublishResults();
      setConfirming(false);
      setFailed(!result.ok);
      setMessage(result.ok ? (result.notice ?? "Done.") : (result.error ?? "Failed."));
    });
  }

  if (!published && !canPublish) {
    return (
      <p className="text-[13px] font-medium text-ink-muted">
        {reason ?? "Stop voting before revealing results."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-[13px] font-medium text-charcoal">
            {published
              ? "Take the winner page down? Visitors will stop seeing the results."
              : "Publish the Top 5 in every category to the public winner page?"}
          </p>
          <button
            type="button"
            onClick={() => run(!published)}
            disabled={pending}
            className="rounded-lg bg-magenta-royal px-4 py-2 text-[13px] font-semibold text-white
                       transition-colors hover:bg-magenta-dark disabled:opacity-60"
          >
            {pending ? "Working…" : published ? "Take it down" : "Publish results"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-muted
                       ring-1 ring-inset ring-line hover:bg-canvas"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setConfirming(true);
          }}
          disabled={pending}
          className={
            "rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 " +
            (published
              ? "bg-surface text-purple-royal ring-1 ring-inset ring-line hover:bg-purple-soft"
              : "bg-magenta-royal text-white hover:bg-magenta-dark")
          }
        >
          {published ? "Take the winner page down" : "Reveal winners"}
        </button>
      )}

      {message && (
        <p
          role="status"
          className={`text-[13px] font-medium ${
            failed ? "text-magenta-dark" : "text-gold-champagne"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
