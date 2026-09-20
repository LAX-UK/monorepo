"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

export type MarketingChromeIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Accessible name (maps to `aria-label`). */
  label: string;
  children: ReactNode;
};

/** 44×44 header chrome icon control with shared focus ring. */
export const MarketingChromeIconButton = forwardRef<
  HTMLButtonElement,
  MarketingChromeIconButtonProps
>(function MarketingChromeIconButton(
  { label, children, className, type = "button", ...rest },
  ref,
) {
  return (
    <Button
      ref={ref}
      type={type}
      variant="ghost"
      size="icon"
      aria-label={label}
      className={cn("min-h-[44px] min-w-[44px]", FOCUS_RING, className)}
      {...rest}
    >
      {children}
    </Button>
  );
});
