import Link from "next/link";

import type { FormType } from "@/lib/types";

const TABS: { formType: FormType; param: string; label: string; hint: string }[] = [
  { formType: "award", param: "award", label: "Award", hint: "AWE Awards 2026 entries" },
  {
    formType: "stall",
    param: "business",
    label: "Business",
    hint: "Business Carnival stall bookings",
  },
];

/**
 * Award and stall entries live in one table and one screen, split by tab.
 *
 * Switching tabs deliberately drops the search, status and category filters:
 * they mean different things on either side, and carrying an award category
 * filter into the stall list would silently show nothing.
 */
export function FormTypeTabs({
  current,
  view,
  counts,
}: {
  current: FormType;
  view: string;
  counts: Record<FormType, number>;
}) {
  return (
    <div role="tablist" aria-label="Entry type" className="flex gap-1 border-b border-line">
      {TABS.map((tab) => {
        const active = tab.formType === current;
        const query = new URLSearchParams();
        if (tab.param !== "award") query.set("form", tab.param);
        if (view === "cards") query.set("view", "cards");
        const suffix = query.toString();

        return (
          <Link
            key={tab.param}
            href={`/admin/applicants${suffix ? `?${suffix}` : ""}`}
            role="tab"
            aria-selected={active}
            title={tab.hint}
            className={
              "-mb-px flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors " +
              (active
                ? "border-magenta-royal text-magenta-royal"
                : "border-transparent text-ink-muted hover:text-purple-royal")
            }
          >
            {tab.label}
            <span
              className={
                "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums " +
                (active ? "bg-magenta-soft text-magenta-royal" : "bg-canvas text-ink-muted")
              }
            >
              {counts[tab.formType]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
