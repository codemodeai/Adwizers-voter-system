"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
        (active
          ? "bg-magenta-royal text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white")
      }
    >
      {children}
    </Link>
  );
}
