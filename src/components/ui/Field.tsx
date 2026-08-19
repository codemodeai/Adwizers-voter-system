import type { ReactNode } from "react";

/* All three control styles reference semantic tokens only, so they invert
 * automatically inside [data-theme="dark"] without a second set of classes.
 *
 * The 16px base size is deliberate: iOS Safari zooms the whole page whenever a
 * focused input is under 16px, which on a multi-step form leaves people
 * stranded mid-zoom between fields. Desktop drops back to 15px. */
const inputBase =
  "w-full rounded-lg border border-line bg-raised px-3.5 py-2.5 text-base sm:text-[15px] text-ink " +
  "placeholder:text-ink-muted/55 transition-colors " +
  "hover:border-line-strong focus:border-accent focus:outline-none " +
  "focus:ring-2 focus:ring-accent/25 disabled:opacity-60";

export const inputClass = inputBase;
export const textareaClass = `${inputBase} min-h-28 resize-y leading-relaxed`;
export const selectClass = `${inputBase} select-chevron pr-10`;

export function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-heading">
      {children}
      {required && (
        <span className="ml-0.5 text-accent" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-accent">
      {children}
    </p>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-snug text-ink-muted">{children}</p>;
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint && <Hint>{hint}</Hint>}
      <FieldError>{error}</FieldError>
    </div>
  );
}
