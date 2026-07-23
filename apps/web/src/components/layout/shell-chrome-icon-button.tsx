"use client";

import { type ChromeSurface, chromeIconButtonClassName } from "@/lib/layout/chrome-surface";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

export type ShellChromeIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Accessible name (maps to `aria-label`). */
  label: string;
  children: ReactNode;
  surface?: ChromeSurface;
};

/** 44×44 shell/marketing header icon control with shared focus ring. */
export const ShellChromeIconButton = forwardRef<HTMLButtonElement, ShellChromeIconButtonProps>(
  function ShellChromeIconButton(
    { label, children, className, surface = "shell", type = "button", ...rest },
    ref,
  ) {
    return (
      <Button
        ref={ref}
        type={type}
        variant="ghost"
        size="icon"
        aria-label={label}
        className={cn(chromeIconButtonClassName(surface, className))}
        {...rest}
      >
        {children}
      </Button>
    );
  },
);
