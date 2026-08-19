import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "@/app/admin/login/actions";
import { NavLink } from "./NavLink";

/** Dashboard modules from Final Plan section 5. Unbuilt ones stay visible but
 *  inert, so the shape of the finished dashboard is obvious from day one. */
const MODULES = [
  { href: "/admin/applicants", label: "Applicants", ready: true },
  { href: "/admin/nominees", label: "Nominees", ready: false },
  { href: "/admin/categories", label: "Categories", ready: false },
  { href: "/admin/voting", label: "Voting Control", ready: false },
  { href: "/admin/analytics", label: "Analytics", ready: false },
  { href: "/admin/results", label: "Results / Winners", ready: false },
  { href: "/admin/export", label: "Export", ready: false },
  { href: "/admin/settings", label: "Settings", ready: false },
];

export function AdminShell({
  adminName,
  children,
}: {
  adminName: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside
        className="shrink-0 bg-purple-royal lg:sticky lg:top-0 lg:flex lg:h-screen
                   lg:w-60 lg:flex-col"
      >
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-champagne">
              AWE Awards
            </p>
            <p className="mt-0.5 text-lg font-bold tracking-tight text-white">2026 Dashboard</p>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:min-h-0 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-6">
          {MODULES.map((m) =>
            m.ready ? (
              <NavLink key={m.href} href={m.href}>
                {m.label}
              </NavLink>
            ) : (
              <span
                key={m.href}
                aria-disabled="true"
                title="Coming in a later phase"
                className="flex shrink-0 items-center justify-between gap-2 whitespace-nowrap
                           rounded-lg px-3 py-2 text-sm font-medium text-white/35"
              >
                {m.label}
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Soon
                </span>
              </span>
            ),
          )}
        </nav>

        <div className="mt-auto hidden border-t border-white/10 px-5 py-4 lg:block">
          <p className="truncate text-[13px] font-medium text-white/80">{adminName}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-1.5 text-[13px] text-white/50 underline underline-offset-2 transition-colors hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-end gap-4 border-b border-line bg-surface px-5 py-3 lg:hidden">
          <span className="truncate text-[13px] text-ink-muted">{adminName}</span>
          <form action={signOut}>
            <button type="submit" className="text-[13px] font-medium text-magenta-royal">
              Sign out
            </button>
          </form>
        </div>

        <main className="min-w-0 flex-1 px-5 py-7 sm:px-7 lg:px-9">{children}</main>

        <footer className="border-t border-line px-5 py-4 text-[12px] text-ink-muted sm:px-7 lg:px-9">
          Phase 1 · Registration &amp; Applicants ·{" "}
          <Link href="/register" className="underline underline-offset-2 hover:text-purple-royal">
            View public form
          </Link>
        </footer>
      </div>
    </div>
  );
}
