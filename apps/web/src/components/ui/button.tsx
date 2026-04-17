import type { ButtonHTMLAttributes, ReactNode } from "react";

const base =
  "inline-flex items-center justify-center font-label font-semibold transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  primary:
    "rounded-md bg-gradient-to-br from-primary to-primary-container px-10 py-4 text-xs uppercase tracking-[0.3em] text-on-primary shadow-sm hover:opacity-95",
  secondary:
    "rounded-md border border-outline-variant/20 bg-transparent px-10 py-4 text-xs uppercase tracking-[0.3em] text-on-surface hover:bg-surface-container-low",
  tertiary:
    "border-b border-primary/0 bg-transparent px-0 py-2 text-label text-xs uppercase tracking-[0.25em] text-primary hover:border-primary",
} as const;

export type ButtonVariant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
