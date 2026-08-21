import type { Metadata } from "next";

import { DarkShell } from "@/components/DarkShell";
import { CARNIVAL_EVENT, STALL_FEE_DISPLAY } from "@/lib/carnival";
import { StallForm } from "./StallForm";

export const metadata: Metadata = {
  title: "Book a stall · Adwizers Business Carnival 2026",
  description:
    "Book your business space at the Adwizers Business Carnival 2026 — showcase, connect, promote and grow.",
};

/**
 * Nothing here is fetched: the stall categories and the offer are code
 * constants, so the page is fully static and served from the CDN.
 */
export default function CarnivalPage() {
  return (
    <DarkShell>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-5 sm:py-12">
        <div className="mb-6 text-center sm:mb-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
            {CARNIVAL_EVENT.spaces}
          </p>
          <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight text-heading sm:mt-2.5 sm:text-4xl">
            Book Your Business Space
          </h1>
          <p className="mx-auto mt-2.5 max-w-lg text-sm text-ink-muted sm:text-[15px]">
            {CARNIVAL_EVENT.date} · {CARNIVAL_EVENT.venue}. Six short steps, and the{" "}
            {STALL_FEE_DISPLAY} space is explained in full before you agree to anything.
          </p>
        </div>

        <StallForm />
      </main>

      <footer className="border-t border-white/10 py-5 text-center text-[13px] text-ink-muted">
        Adwizers Business Carnival 2026 · Adwizers Women Empowerment
      </footer>
    </DarkShell>
  );
}
