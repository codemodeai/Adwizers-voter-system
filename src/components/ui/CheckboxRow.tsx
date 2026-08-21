import type { ReactNode } from "react";

import { FieldError } from "@/components/ui/Field";

/**
 * A consent line: the checkbox, an optional heading, and the wording being
 * agreed to. Used by both entry forms for declarations and fee agreements.
 */
export function CheckboxRow({
  name,
  title,
  defaultChecked,
  required,
  error,
  children,
}: {
  name: string;
  /** Heading shown above the consent text, e.g. "Nomination Declaration". */
  title?: string;
  defaultChecked?: boolean;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        className={
          "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm leading-relaxed " +
          "transition-colors has-checked:border-accent/50 has-checked:bg-accent-soft " +
          (error ? "border-accent/60 bg-accent-soft" : "border-line bg-raised")
        }
      >
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="mt-0.5 size-4.5 shrink-0 accent-accent"
        />
        <span className="text-ink">
          {title && (
            <span className="mb-0.5 block font-semibold text-heading">
              {title}
              {required && (
                <span className="ml-0.5 text-accent" aria-hidden="true">
                  *
                </span>
              )}
            </span>
          )}
          <span className={title ? "block text-ink-muted" : undefined}>
            {children}
            {required && !title && (
              <span className="ml-0.5 text-accent" aria-hidden="true">
                *
              </span>
            )}
          </span>
        </span>
      </label>
      <FieldError>{error}</FieldError>
    </div>
  );
}
