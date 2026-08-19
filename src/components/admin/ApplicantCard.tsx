import Link from "next/link";

import { ApplicantAvatar } from "@/components/admin/ApplicantAvatar";
import { PaymentToggle } from "@/components/admin/PaymentToggle";
import { PromoteButton } from "@/components/admin/PromoteButton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { categoryLabel, type ApplicantWithCategory } from "@/lib/types";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/**
 * Compact tile: photo-led, four to a row.
 *
 * Deliberately narrower than the table row -- at ~300px there is no space for
 * a label column, so contact details are stacked bare and area is dropped.
 * Anything omitted is one click away in Review.
 */
export function ApplicantCard({
  applicant: a,
  logoUrl,
}: {
  applicant: ApplicantWithCategory;
  logoUrl: string | null;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md">
      {/* Status and date sit in the top-right corner rather than on their own
        * row, which saves a line of height on every tile. */}
      <div className="flex items-start gap-2.5 p-3">
        <ApplicantAvatar url={logoUrl} name={a.full_name} size={40} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/applicants/${a.id}`}
            className="block truncate text-sm font-semibold text-purple-royal hover:text-magenta-royal"
          >
            {a.full_name}
          </Link>
          <p className="truncate text-[12px] text-ink-muted">{a.business_name}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={a.status} compact />
          <span className="text-[11px] text-ink-muted">{shortDate(a.created_at)}</span>
        </div>
      </div>

      <div className="space-y-1 border-t border-line px-3 py-2.5 text-[12px]">
        <p className="truncate font-medium text-charcoal" title={categoryLabel(a)}>
          {categoryLabel(a)}
        </p>
        <p className="truncate tabular-nums text-ink-muted">{a.whatsapp_number}</p>
        <p className="truncate text-ink-muted" title={a.email}>
          {a.email}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line bg-canvas px-3 py-2.5">
        <PaymentToggle id={a.id} status={a.status} />
        <div className="flex items-center gap-2.5">
          <PromoteButton id={a.id} status={a.status} />
          <Link
            href={`/admin/applicants/${a.id}`}
            className="text-[12px] font-semibold text-magenta-royal hover:underline"
          >
            Review
          </Link>
        </div>
      </div>
    </article>
  );
}
