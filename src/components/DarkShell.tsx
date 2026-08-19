import type { ReactNode } from "react";

import { BrandHeader } from "@/components/BrandHeader";

/**
 * Dark, grained backdrop for the public entry flow.
 *
 * `data-theme="dark"` re-points the semantic colour tokens defined in
 * globals.css, so every component inside inverts without a second set of
 * classes -- the admin dashboard, which sits outside this shell, stays light.
 */
export function DarkShell({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="dark"
      className="noise relative isolate flex min-h-full flex-1 flex-col bg-canvas"
    >
      {/* Colour wash: two brand-hued glows so the background has depth rather
       * than reading as one flat panel of near-black. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 size-[36rem] rounded-full bg-purple-royal/45 blur-[130px]" />
        <div className="absolute -right-32 top-1/3 size-[30rem] rounded-full bg-magenta-royal/25 blur-[130px]" />
        <div className="absolute -bottom-40 left-1/4 size-[28rem] rounded-full bg-gold-champagne/10 blur-[130px]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        <BrandHeader onDark />
        {children}
      </div>
    </div>
  );
}
