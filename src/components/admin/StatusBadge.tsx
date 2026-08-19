import {
  STATUS_LABEL,
  STATUS_LABEL_SHORT,
  STATUS_STYLE,
  type ApplicantStatus,
} from "@/lib/types";

export function StatusBadge({
  status,
  compact = false,
}: {
  status: ApplicantStatus;
  compact?: boolean;
}) {
  return (
    <span
      // The full wording stays available on hover when the label is shortened.
      title={compact ? STATUS_LABEL[status] : undefined}
      className={
        "inline-flex whitespace-nowrap rounded-full font-semibold ring-1 ring-inset " +
        (compact ? "px-2 py-0.5 text-[11px] " : "px-2.5 py-1 text-[12px] ") +
        STATUS_STYLE[status]
      }
    >
      {compact ? STATUS_LABEL_SHORT[status] : STATUS_LABEL[status]}
    </span>
  );
}
