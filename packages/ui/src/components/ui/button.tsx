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
        destructive: "bg-error text-on-error shadow-sm hover:opacity-95",
        success: "bg-success text-on-success shadow-sm hover:opacity-95",
        outline:
          "border border-outline-variant/25 bg-surface-container-lowest shadow-sm hover:bg-surface-container-low",
        secondary: "bg-secondary-container text-on-secondary-container shadow-sm hover:opacity-95",
        ghost: "hover:bg-surface-container-high hover:text-on-surface",
        link: "text-primary underline-offset-4 hover:underline",
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
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        /** Full-width auth / hero primary button */
        xl: "h-[60px] min-h-[44px] w-full px-8 py-[18px] text-base font-semibold leading-6 tracking-wide",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
