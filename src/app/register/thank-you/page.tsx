import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { DarkShell } from "@/components/DarkShell";

export const metadata: Metadata = {
  title: "Application received · AWE Awards 2026",
  robots: { index: false },
};

const STEPS = [
  "Our team reviews your entry and may reach out on WhatsApp if anything is missing.",
  "Once your entry is confirmed, we will let you know about the nomination fee.",
  "If you are selected as a nominee, you will get an email at the address you gave us, and your profile goes live on your category's voting page.",
];

export default function ThankYouPage() {
  return (
    <DarkShell>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-5 sm:py-12">
        {/* Same split card as the form, so the finish belongs to the flow it
         * came from rather than dropping onto an unrelated page. */}
        <div
          className="grid overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl
                     shadow-black/40 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
        >
          <div className="noise noise-strong relative isolate h-40 overflow-hidden bg-purple-royal sm:h-52 md:h-auto">
            <Image
              src="/steps/success.jpg"
              alt=""
              aria-hidden="true"
              fill
              priority
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="animate-rise object-cover object-[center_28%] md:object-center"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#0f0016] via-[#0f0016]/25 to-transparent"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-purple-royal/40 via-transparent to-magenta-royal/25"
            />
            <div className="relative z-10 hidden h-full flex-col justify-end p-5 md:flex md:p-7 lg:p-9">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
                Entry Received
              </p>
              <p className="mt-2.5 max-w-[16rem] text-[22px] font-semibold leading-snug text-white">
                Your story is with us now.
              </p>
            </div>
          </div>

          <div className="animate-rise p-5 sm:p-8 lg:p-10">
            <div
              aria-hidden="true"
              className="flex size-14 items-center justify-center rounded-full bg-accent-soft
                         ring-1 ring-accent/30"
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-7 text-accent">
                <path
                  d="m5 13 4.2 4.2L19 7.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h1 className="mt-5 text-xl font-semibold tracking-tight text-heading sm:text-2xl md:text-3xl">
              Thank you — we have your entry
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-muted sm:text-[15px]">
              Your application for the AWE Awards 2026 has been submitted. Here is what happens
              next.
            </p>

            <ol className="mt-7 space-y-4">
              {STEPS.map((step, i) => (
                <li key={i} className="flex gap-3.5">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full
                               bg-accent/15 text-[12px] font-semibold text-accent ring-1 ring-accent/25"
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-ink">{step}</span>
                </li>
              ))}
            </ol>

            <div
              aria-hidden="true"
              className="my-7 h-px w-full bg-gradient-to-r from-transparent via-gold/50 to-transparent"
            />

            <p className="text-[13px] leading-relaxed text-ink-muted">
              Please do not submit the form twice. If you need to change something, contact the AWE
              team on WhatsApp.
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-line
                         bg-raised px-5 py-2.5 text-sm font-semibold text-heading
                         transition-colors hover:border-accent/40 hover:bg-accent-soft"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-5 text-center text-[13px] text-ink-muted">
        AWE Awards 2026 · Adwizers Women Empowerment
      </footer>
    </DarkShell>
  );
}
