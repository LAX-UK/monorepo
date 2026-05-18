import { cn } from "@auction/ui";
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const base =
  "inline-flex items-center justify-center gap-2 font-label font-semibold transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:pointer-events-none";

const sizes = {
  sm: "min-h-9 px-4 py-2 text-xs",
  md: "min-h-11 px-6 py-3 text-xs",
  lg: "min-h-12 px-8 py-3.5 text-sm",
} as const;

const variants = {
  primary:
    "rounded-md bg-gradient-to-br from-primary to-primary-container uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary shadow-sm hover:opacity-95",
  secondary:
    "rounded-md border border-border-hairline bg-transparent uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:bg-surface-container-low",
  tertiary:
    "min-h-0 border-b border-primary/0 bg-transparent px-0 py-2 text-label uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:border-primary",
  destructive:
    "rounded-md bg-error uppercase tracking-[0.18em] text-on-error shadow-sm hover:opacity-95",
  success:
    "rounded-md bg-success uppercase tracking-[0.18em] text-on-success shadow-sm hover:opacity-95",
  ctaLink:
    "min-h-0 border-b border-primary/0 bg-transparent px-0 py-0 uppercase tracking-[0.18em] text-primary hover:border-primary",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  type = "button",
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  const isLinkShape = variant === "tertiary" || variant === "ctaLink";

  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(base, isLinkShape ? null : sizes[size], variants[variant], className)}
      {...props}
    >
      {children}
    </Comp>
  );
}
