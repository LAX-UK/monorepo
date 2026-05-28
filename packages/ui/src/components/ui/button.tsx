"use client";

import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary shadow hover:opacity-95",
        /** Gradient primary CTA (dashboard / auth flows). */
        primary:
          "rounded-md bg-gradient-to-br from-primary to-primary-container font-label font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary shadow-sm hover:opacity-95",
        destructive: "bg-error text-on-error shadow-sm hover:opacity-95",
        success: "bg-success text-on-success shadow-sm hover:opacity-95",
        outline:
          "border border-outline-variant/25 bg-surface-container-lowest shadow-sm hover:bg-surface-container-low",
        secondary: "bg-secondary-container text-on-secondary-container shadow-sm hover:opacity-95",
        /** Bordered label-caps secondary (legacy app Button). */
        secondaryOutline:
          "rounded-md border border-border-hairline bg-transparent font-label font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:bg-surface-container-low",
        ghost: "hover:bg-surface-container-high hover:text-on-surface",
        link: "text-primary underline-offset-4 hover:underline",
        /** Text link with underline-on-hover (legacy app tertiary). */
        tertiary:
          "h-auto min-h-0 rounded-none border-b border-primary/0 bg-transparent p-0 px-0 py-2 font-label text-label font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary shadow-none hover:border-primary focus-visible:ring-accent-brand",
        ctaLink:
          "h-auto min-h-0 rounded-none bg-transparent p-0 font-label text-xs font-semibold uppercase tracking-[0.18em] text-primary shadow-none hover:underline focus-visible:ring-accent-brand",
        /** Primary marketing CTA (solid) */
        cta: "rounded bg-cta-bg text-cta-on shadow-none hover:opacity-95 focus-visible:ring-accent-brand",
        /** “Join live” style — border + label caps */
        liveJoin:
          "rounded border border-brand-100 bg-transparent font-label text-base font-semibold uppercase tracking-wide text-brand-100 shadow-none hover:bg-white/5 dark:border-on-surface-variant dark:text-on-surface-variant",
        /** Text “View all” with chevron slot — pair with `asChild` + Link */
        chevron:
          "h-auto min-h-[44px] rounded-none bg-transparent p-0 font-label text-base font-semibold tracking-[0.8px] text-brand-900 shadow-none hover:underline focus-visible:ring-accent-brand dark:text-on-surface",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "min-h-9 rounded-md px-4 py-2 text-xs",
        md: "min-h-11 rounded-md px-6 py-3 text-xs",
        lg: "min-h-12 rounded-md px-8 py-3.5 text-sm",
        icon: "min-h-[var(--tap-target-min,44px)] min-w-[var(--tap-target-min,44px)] h-[var(--tap-target-min,44px)] w-[var(--tap-target-min,44px)]",
        /** Touch-friendly icon button */
        touch: "min-h-[var(--tap-target-min,44px)] min-w-[var(--tap-target-min,44px)] px-3",
        /** Link-shaped controls — no block tap target */
        link: "h-auto min-h-0 p-0",
        /** Full-width auth / hero primary button */
        xl: "h-[60px] min-h-[44px] w-full px-8 py-[18px] text-base font-semibold leading-6 tracking-wide",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const isLinkShape =
      variant === "tertiary" ||
      variant === "ctaLink" ||
      variant === "link" ||
      variant === "chevron";
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size: isLinkShape ? "link" : size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
