"use client";

import { useState } from "react";

import { absoluteInBrowser, nomineeInviteMessage, whatsappNumber, whatsappShareUrl } from "@/lib/share";

/**
 * A nominee's personal voting link in the dashboard, with the three things an
 * admin does with it: copy it, send it to her on WhatsApp, or open it.
 *
 * WhatsApp opens straight into a chat with the number from her entry when it
 * is a usable one, with the message already written; otherwise it opens at the
 * contact picker with the same message, so the admin can choose who gets it.
 *
 * `live` is false while her profile or her category is hidden. The link is
 * still shown -- it is permanent, and an admin may want it ready -- but marked,
 * because sending it now would hand her a page that does not open.
 */
export function NomineeLinkTools({
  url,
  code,
  name,
  categoryName,
  phone,
  live,
  size = "sm",
}: {
  url: string;
  code: string;
  name: string;
  categoryName: string | null;
  phone: string | null;
  live: boolean;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const hasNumber = Boolean(whatsappNumber(phone));

  async function copy() {
    try {
      await navigator.clipboard.writeText(absoluteInBrowser(url));
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2000);
  }

  const shown = url.replace(/^https?:\/\//, "");
  const button =
    size === "md"
      ? "rounded-lg px-3.5 py-2 text-[13px]"
      : "rounded-md px-2.5 py-1 text-[12px]";

  return (
    <div className="min-w-0">
      <p
        title={url}
        className={`truncate font-mono ${size === "md" ? "text-[13px]" : "text-[12px]"} ${
          live ? "text-purple-royal" : "text-neutral-400 line-through"
        }`}
      >
        {shown}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={copy}
          className={`${button} font-semibold ring-1 ring-inset transition-colors ${
            copied === "copied"
              ? "bg-magenta-royal text-white ring-magenta-royal"
              : "bg-white text-magenta-royal ring-magenta-royal/25 hover:bg-magenta-soft"
          }`}
        >
          {copied === "copied" ? "Copied" : copied === "failed" ? "Select it" : "Copy link"}
        </button>

        <a
          href="#"
          onClick={(event) => {
            // Built at click time, so the message carries an absolute link
            // even when the dashboard rendered a relative one.
            const link = absoluteInBrowser(url);
            event.currentTarget.href = whatsappShareUrl(
              nomineeInviteMessage({ name, categoryName, code, url: link }),
              phone,
            );
          }}
          target="_blank"
          rel="noreferrer"
          title={
            hasNumber
              ? `Opens a WhatsApp chat with ${phone}`
              : "No usable number on her entry — pick the contact in WhatsApp"
          }
          className={`${button} bg-[#25D366]/15 font-semibold text-[#0f7a3c] ring-1 ring-inset
                      ring-[#25D366]/40 transition-colors hover:bg-[#25D366]/25`}
        >
          {hasNumber ? "Send on WhatsApp" : "WhatsApp"}
        </a>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={`${button} font-medium text-ink-muted underline-offset-2 hover:text-purple-royal hover:underline`}
        >
          Open ↗
        </a>
      </div>

      {!live && (
        <p className="mt-1 text-[11px] font-medium text-magenta-dark">
          Hidden — this link will not open until she is live.
        </p>
      )}
    </div>
  );
}
