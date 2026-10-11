"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { forwardRef } from "react";
import { MarketingHeartIcon } from "./marketing-icons.js";

export type MarketingHeartToggleProps = {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  /** Accessible name, e.g. “Save Untitled to favorites”; state is conveyed by `aria-pressed`. */
  label: string;
  disabled?: boolean;
  /** Pending requests keep the control focusable but ignore extra presses. */
  busy?: boolean;
  className?: string;
};

/** 40px round favorite toggle inside a 44×44 hit area (cards, detail pages). */
export const MarketingHeartToggle = forwardRef<HTMLButtonElement, MarketingHeartToggleProps>(
  function MarketingHeartToggle(
    { pressed, onPressedChange, label, disabled, busy = false, className },
    ref,
  ) {
    return (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-pressed={pressed}
        aria-busy={busy || undefined}
        disabled={disabled}
        data-state={pressed ? "on" : "off"}
        onClick={() => {
          if (busy) return;
          onPressedChange(!pressed);
        }}
        className={cn(
          "group/heart size-11 min-h-11 min-w-11 rounded-full bg-transparent p-0 hover:bg-transparent",
          FOCUS_RING,
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-10 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none",
            pressed
              ? "border-primary bg-primary text-on-primary"
              : "border-outline-variant bg-surface text-on-surface group-hover/heart:bg-surface-container-low",
          )}
        >
          <MarketingHeartIcon className={cn("size-5", pressed && "fill-current")} />
        </span>
      </Button>
    );
  },
);
