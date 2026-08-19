"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { inputClass, selectClass } from "@/components/ui/Field";
import { APPLICANT_STATUSES, STATUS_LABEL, type Category } from "@/lib/types";

export function ApplicantFilters({
  categories,
  defaultSearch,
  defaultStatus,
  defaultCategory,
}: {
  categories: Category[];
  defaultSearch: string;
  defaultStatus: string;
  defaultCategory: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(defaultSearch);
  const firstRender = useRef(true);

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // Any filter change invalidates the current page offset.
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  // Debounce typing so each keystroke does not trigger a query.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = setTimeout(() => apply({ q: search.trim() }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters = Boolean(defaultSearch || defaultStatus || defaultCategory);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <label htmlFor="applicant-search" className="sr-only">
          Search applicants
        </label>
        <input
          id="applicant-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, business, email, phone, or area…"
          className={inputClass}
        />
      </div>

      <div className="flex gap-3">
        <div>
          <label htmlFor="filter-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="filter-status"
            defaultValue={defaultStatus}
            onChange={(e) => apply({ status: e.target.value })}
            className={`${selectClass} sm:w-44`}
          >
            <option value="">All statuses</option>
            {APPLICANT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-category" className="sr-only">
            Filter by category
          </label>
          <select
            id="filter-category"
            defaultValue={defaultCategory}
            onChange={(e) => apply({ category: e.target.value })}
            className={`${selectClass} sm:w-52`}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasFilters && (
        <Link
          href={pathname}
          className="shrink-0 self-start text-[13px] font-medium text-magenta-royal
                     hover:underline sm:self-center"
        >
          Clear
        </Link>
      )}
    </div>
  );
}
