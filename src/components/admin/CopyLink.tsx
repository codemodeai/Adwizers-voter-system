"use client";

import { useState } from "react";

/**
 * The category's shareable voting link (Final Plan sections 5 and 6) with a
 * one-tap copy.
 *
 * This link is the product of the Categories screen -- it is what actually gets
 * pasted into WhatsApp -- so it is shown in full and selectable, not hidden
 * behind an icon. The clipboard write can be refused (insecure origin, denied
 * permission), so a failure falls back to selecting the text rather than
 * silently doing nothing.
 */
export function CopyLink({ url, disabled = false }: { url: string; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <code
        title={url}
        className={`min-w-0 flex-1 truncate rounded-md bg-canvas px-2 py-1 text-[12px]
                    ring-1 ring-inset ring-line ${
                      disabled ? "text-neutral-400 line-through" : "text-charcoal"
                    }`}
      >
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-magenta-royal
                   transition-colors hover:bg-magenta-soft"
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Select it" : "Copy"}
      </button>
    </span>
  );
}
