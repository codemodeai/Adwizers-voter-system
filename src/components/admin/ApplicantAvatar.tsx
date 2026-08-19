import Image from "next/image";

/** "Priya Raghavan" -> "PR". Falls back to a single letter for one-word names. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Row thumbnail for the applicants list. Uses the submitted logo / product
 * photo where there is one, so admins can recognise an entry without opening
 * it, and initials where there is not -- which doubles as an at-a-glance flag
 * for entries still missing an image before promotion.
 */
export function ApplicantAvatar({
  url,
  name,
  size = 40,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        unoptimized
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover ring-1 ring-line"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-purple-soft
                 text-[13px] font-semibold text-purple-royal ring-1 ring-purple-royal/10"
    >
      {initials(name)}
    </span>
  );
}
