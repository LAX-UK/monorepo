import { cn } from "@auction/ui";
import { Button as UiButton } from "@auction/ui/components/button";
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
  destructive:
    "rounded-md bg-error px-6 py-3 text-xs uppercase tracking-[0.18em] text-on-error shadow-sm hover:opacity-95",
  success:
    "rounded-md bg-success px-6 py-3 text-xs uppercase tracking-[0.18em] text-on-success shadow-sm hover:opacity-95",
  ctaLink:
    "border-b border-primary/0 bg-transparent px-0 py-0 text-xs uppercase tracking-[0.18em] text-primary hover:border-primary",
} as const;

export type ButtonVariant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
  asChild?: boolean;
}) {
  return (
    <UiButton
      type={type}
      variant="ghost"
      asChild={asChild}
      className={cn(
        base,
        variants[variant],
        "h-auto min-h-0 rounded-none px-[inherit] py-[inherit] shadow-none hover:bg-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </UiButton>
  );
}
