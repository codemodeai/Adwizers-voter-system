import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-sm hover:bg-accent-hover active:bg-accent-hover " +
    "disabled:bg-accent/40 disabled:shadow-none",
  secondary:
    "bg-surface text-heading ring-1 ring-inset ring-line hover:border-line-strong " +
    "hover:bg-accent-soft hover:ring-accent/30 disabled:text-ink-muted",
  ghost: "text-heading hover:bg-accent-soft disabled:text-ink-muted",
  danger: "bg-surface text-accent ring-1 ring-inset ring-accent/30 hover:bg-accent-soft",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm " +
        "font-semibold transition-colors disabled:cursor-not-allowed " +
        `${VARIANTS[variant]} ${className}`
      }
    />
  );
}
