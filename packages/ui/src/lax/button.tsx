"use client";

import { Slot, Slottable } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils.js";
import { buttonVariants } from "./button-variants.js";
import { ReasonTooltip } from "./tooltip.js";

/**
 * The LAX system button, for the staff tools and the client workspace. Its look is
 * `buttonVariants` (a plain module, so server components can use the classes too).
 */

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child (e.g. a router link) with button styling. */
    asChild?: boolean;
    /** Shows a spinner in place of the leading icon and blocks repeat clicks; width is kept. */
    loading?: boolean;
    /** Leading icon element, e.g. `<Plus />`. */
    icon?: React.ReactNode;
    /**
     * Disables the button and says why ("Refunds open once payment settles"). The button stays
     * focusable (`aria-disabled`, not `disabled`) and shows the reason in a tooltip on hover and
     * focus, so keyboard and screen reader users can find out what blocks it.
     */
    disabledReason?: string;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      icon,
      disabled,
      disabledReason,
      children,
      type,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const leading = loading ? <LoaderCircle aria-hidden className="animate-spin" /> : icon;
    const explained = Boolean(disabledReason) && !loading;
    const button = (
      <Comp
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          explained && "cursor-not-allowed aria-disabled:pointer-events-auto",
          className,
        )}
        {...(asChild ? {} : { type: type ?? "button", disabled: explained ? undefined : disabled })}
        {...((asChild && disabled) || explained ? { "aria-disabled": true } : {})}
        {...props}
        {...(explained
          ? {
              // Focusable but inert: the press is swallowed, the reason is shown instead.
              onClick: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
            }
          : {})}
        {...(loading
          ? {
              "aria-busy": true,
              "data-loading": "",
              // Keeps its colours while busy (not the disabled look) but ignores repeat presses.
              onClick: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
            }
          : {})}
      >
        {leading}
        <Slottable>{children}</Slottable>
      </Comp>
    );
    if (!explained || !disabledReason) return button;
    return <ReasonTooltip reason={disabledReason}>{button}</ReasonTooltip>;
  },
);
Button.displayName = "Button";
