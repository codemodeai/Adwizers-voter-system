import { REGISTRATION_FEE_INR } from "@/lib/fee";

/** Shows the amount this applicant was quoted, falling back to today's fee for
 *  rows saved before the amount was recorded alongside the agreement. */
export function formatFee(amount: number | null): string {
  return `₹${(amount ?? REGISTRATION_FEE_INR).toLocaleString("en-IN")}`;
}

/**
 * Whether this applicant agreed to pay, at a glance.
 *
 * A null `fee_agreed_at` means no agreement is on record -- which for every
 * entry taken before the fee step was added to the form is simply because
 * nobody was ever asked. The badge reads "Not agreed" either way; the detail
 * page carries the explanation.
 */
export function FeeBadge({
  agreedAt,
  amount,
  compact = false,
}: {
  agreedAt: string | null;
  amount?: number | null;
  compact?: boolean;
}) {
  const agreedOn = agreedAt ? new Date(agreedAt) : null;

  return (
    <span
      title={
        agreedOn
          ? `Agreed to pay ${formatFee(amount ?? null)} on ${agreedOn.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}`
          : "No fee agreement on record"
      }
      className={
        "inline-flex whitespace-nowrap rounded-full font-semibold ring-1 ring-inset " +
        (compact ? "px-2 py-0.5 text-[11px] " : "px-2.5 py-1 text-[12px] ") +
        (agreedOn
          ? "bg-gold-soft text-gold-champagne ring-gold-champagne/25"
          : "bg-magenta-soft text-magenta-royal ring-magenta-royal/20")
      }
    >
      {agreedOn ? "Fee agreed" : "Not agreed"}
    </span>
  );
}
