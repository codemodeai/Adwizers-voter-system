import Image from "next/image";
import Link from "next/link";

import { DarkShell } from "@/components/DarkShell";

export default function HomePage() {
  return (
    <DarkShell>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 py-16 text-center">
        {/* Dark-on-light lockup, presented on a warm plate so the wordmark
         * stays legible instead of disappearing into the background. */}
        <div className="rounded-2xl bg-[#fdf8f2] px-8 py-6 shadow-2xl shadow-black/40 ring-1 ring-gold-champagne/30">
          <Image
            src="/awe-logo.png"
            alt="AWE — Adwizers Women Empowerment"
            width={640}
            height={404}
            priority
            className="h-24 w-auto"
          />
        </div>

        <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
          Awards 2026 · Entries Open
        </p>
        <h1 className="mt-3 animate-rise text-3xl font-bold tracking-tight text-heading sm:text-4xl">
          Celebrating the women building something of their own
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-muted">
          Share your business, your journey, and your proudest moment. Selected entries become
          nominees on their category&apos;s public voting page.
        </p>

        <Link
          href="/register"
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-accent
                     px-8 py-3.5 text-base font-semibold text-white shadow-lg
                     shadow-accent/25 transition-colors hover:bg-accent-hover"
        >
          Enter the Awards
        </Link>

        <div
          aria-hidden="true"
          className="mx-auto mt-10 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent"
        />
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.3em] text-ink-muted">
          Inspire · Empower · Achieve
        </p>
      </main>

      {/* No link to the dashboard here. It lives on its own domain, and a
       * public signpost to the sign-in page invites traffic that has no
       * business finding it. Admins go there directly. */}
      <footer className="border-t border-white/10 py-5 text-center text-[13px] text-ink-muted">
        AWE Awards 2026 · Adwizers Women Empowerment
      </footer>
    </DarkShell>
  );
}
