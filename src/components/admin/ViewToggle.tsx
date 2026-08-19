"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ApplicantView = "table" | "cards";

const OPTIONS: { value: ApplicantView; label: string; icon: React.ReactNode }[] = [
  {
    value: "table",
    label: "Table",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-4">
        <path
          d="M3 5h14M3 10h14M3 15h14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    value: "cards",
    label: "Cards",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-4">
        <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
];

/** Switches the applicants list between the dense table and photo-led cards.
 *  Kept in the URL so a view survives refreshes and can be shared. */
export function ViewToggle({ view }: { view: ApplicantView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(next: ApplicantView) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "table") params.delete("view");
    else params.set("view", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex shrink-0 rounded-lg border border-line bg-surface p-1"
    >
      {OPTIONS.map((option) => {
        const active = view === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            aria-pressed={active}
            className={
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] " +
              "font-semibold transition-colors " +
              (active
                ? "bg-purple-royal text-white"
                : "text-ink-muted hover:bg-purple-soft hover:text-purple-royal")
            }
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
