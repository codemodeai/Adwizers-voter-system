"use client";

import { useState, useTransition } from "react";

import { setNomineePublished } from "@/app/admin/(dashboard)/nominees/actions";

/**
 * Publish / unpublish a nominee (Final Plan section 5).
 *
 * Reads as a statement of where the card currently is -- "Live" or "Hidden" --
 * rather than as the action it performs, because the state is what an admin
 * scanning a list of forty nominees actually needs to see.
 */
export function PublishToggle({
  id,
  published,
  size = "sm",
}: {
  id: string;
  published: boolean;
  size?: "sm" | "md";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pad = size === "md" ? "px-3.5 py-2 text-[13px]" : "px-2.5 py-1.5 text-[12px]";

  function toggle() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await setNomineePublished(id, !published);
      if (!result.ok) setError(result.error ?? "Could not change this.");
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={published ? "Hide from the category page" : "Show on the category page"}
        className={
          `inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-semibold ` +
          `ring-1 ring-inset transition-colors disabled:opacity-60 ${pad} ` +
          (published
            ? "bg-magenta-soft text-magenta-royal ring-magenta-royal/20 hover:bg-magenta-royal hover:text-white"
            : "bg-neutral-100 text-neutral-500 ring-line hover:bg-purple-soft hover:text-purple-royal")
        }
      >
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${published ? "bg-magenta-royal" : "bg-neutral-400"}`}
        />
        {pending ? "Saving…" : published ? "Live" : "Hidden"}
      </button>
      {error && (
        <span role="alert" className="text-[11px] font-medium text-magenta-dark">
          {error}
        </span>
      )}
    </span>
  );
}
