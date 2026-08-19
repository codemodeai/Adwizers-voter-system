import Image from "next/image";
import Link from "next/link";

/**
 * Slim site bar. Deliberately short so the form itself fills the first screen.
 * `onDark` swaps the logo for its light-safe treatment and drops the border.
 */
export function BrandHeader({
  action,
  onDark = false,
}: {
  action?: React.ReactNode;
  onDark?: boolean;
}) {
  return (
    <header
      className={
        "relative z-20 " +
        (onDark
          ? "border-b border-white/10"
          : "sticky top-0 border-b border-line bg-surface/85 backdrop-blur-sm")
      }
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          {/* The mark is dark-on-light artwork, so on the dark surfaces it sits
           * on a warm brand chip rather than fighting the background. */}
          <span
            className={
              onDark
                ? "rounded-lg bg-[#fdf8f2] px-2.5 py-1.5 shadow-sm ring-1 ring-gold-champagne/30"
                : ""
            }
          >
            <Image
              src="/awe-mark.png"
              alt="AWE — Adwizers Women Empowerment"
              width={520}
              height={258}
              priority
              className={onDark ? "h-6 w-auto" : "h-9 w-auto"}
            />
          </span>
          <span
            className={
              "hidden border-l pl-2.5 text-[11px] font-semibold uppercase leading-tight " +
              "tracking-[0.18em] sm:block " +
              (onDark ? "border-white/15 text-white/55" : "border-line text-ink-muted")
            }
          >
            Awards
            <span className={onDark ? "block text-white" : "block text-purple-royal"}>2026</span>
          </span>
        </Link>
        {action}
      </div>
    </header>
  );
}
