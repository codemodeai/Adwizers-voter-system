"use client";

import { useState } from "react";

import { absoluteInBrowser, supporterShareMessage, whatsappShareUrl } from "@/lib/share";

/**
 * "Share her page", on the nominee's own voting page.
 *
 * The whole point of a personal link is that it travels -- the nominee sends
 * it out, and her supporters send it on -- so passing it along is one tap from
 * the page itself rather than something a voter has to work out.
 */
export function ShareNominee({
  url,
  name,
  businessName,
  categoryName,
}: {
  url: string;
  name: string;
  businessName: string;
  categoryName: string;
}) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  function message() {
    return supporterShareMessage({ name, businessName, categoryName, url: absoluteInBrowser(url) });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(absoluteInBrowser(url));
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2000);
  }

  return (
    <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-line bg-surface/60 p-5 text-center">
      <p className="text-[14px] font-semibold text-heading">Support {name} — share her page</p>
      <p className="mt-1 text-[12px] text-ink-muted">
        Every vote on this link counts for her.
      </p>

      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <a
          href="#"
          onClick={(event) => {
            // Built at click time, so the link is absolute even when the page
            // was rendered with a relative one.
            event.currentTarget.href = whatsappShareUrl(message());
          }}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-[#25D366] px-5 py-2.5 text-[14px] font-semibold text-[#0b3d1f]
                     transition-opacity hover:opacity-90"
        >
          Share on WhatsApp
        </a>
        <button
          type="button"
          onClick={copy}
          className="rounded-xl bg-raised px-5 py-2.5 text-[14px] font-semibold text-heading
                     ring-1 ring-inset ring-line transition-colors hover:ring-line-strong"
        >
          {copied === "copied" ? "Link copied" : copied === "failed" ? "Copy failed" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
