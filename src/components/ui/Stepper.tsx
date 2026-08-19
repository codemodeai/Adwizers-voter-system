"use client";

/**
 * Numbered progress rail. Completed steps are clickable so people can jump
 * back to fix an answer without losing what they have already typed; steps
 * ahead stay locked until the current one validates.
 */
export function Stepper({
  steps,
  current,
  furthest,
  onJump,
}: {
  steps: string[];
  current: number;
  furthest: number;
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const reachable = i <= furthest;

          return (
            <li
              key={label}
              className={i === steps.length - 1 ? "flex items-center" : "flex flex-1 items-center"}
            >
              <button
                type="button"
                onClick={() => reachable && onJump(i)}
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                title={label}
                className={
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] sm:size-8 sm:text-[12px] " +
                  "font-semibold transition-all duration-300 " +
                  (active
                    ? "scale-110 bg-accent text-white ring-4 ring-accent/20"
                    : done
                      ? "bg-accent text-white hover:bg-accent-hover"
                      : "border border-line bg-raised text-ink-muted") +
                  (reachable ? " cursor-pointer" : " cursor-default")
                }
              >
                {done ? (
                  <svg viewBox="0 0 20 20" fill="none" className="size-3 sm:size-3.5" aria-hidden="true">
                    <path
                      d="m4.5 10.5 3.5 3.5 7.5-8"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
                <span className="sr-only">{label}</span>
              </button>

              {i < steps.length - 1 && (
                <span aria-hidden="true" className="mx-1.5 h-px flex-1 rounded-full bg-line sm:mx-2">
                  {/* Inner bar animates its width so progress reads as motion. */}
                  <span
                    className={
                      "block h-px rounded-full bg-accent transition-all duration-500 ease-out " +
                      (done ? "w-full" : "w-0")
                    }
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
