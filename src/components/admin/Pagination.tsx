"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pageCount <= 1) return null;

  function hrefFor(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  const base =
    "rounded-lg px-3 py-2 text-[13px] font-semibold ring-1 ring-inset transition-colors";
  const enabled = "bg-white text-purple-royal ring-line hover:bg-purple-soft";
  const disabled = "bg-canvas text-ink-muted/50 ring-line cursor-not-allowed";

  return (
    <nav aria-label="Pagination" className="flex items-center gap-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={`${base} ${enabled}`}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} ${disabled}`}>
          Previous
        </span>
      )}

      <span className="px-1 text-[13px] tabular-nums text-ink-muted">
        Page {page} of {pageCount}
      </span>

      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={`${base} ${enabled}`}>
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} ${disabled}`}>
          Next
        </span>
      )}
    </nav>
  );
}
