import type { ReactNode } from "react";

/**
 * The summary tile used across the dashboard. Extracted after the third copy
 * appeared -- the numbers differ per screen, the treatment should not.
 */
export function StatTile({
  label,
  value,
  tone = "text-purple-royal",
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
      <p className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-ink-muted">{hint}</p>}
    </div>
  );
}
