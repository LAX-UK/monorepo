"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { forwardRef } from "react";
import { MarketingHeartIcon } from "./marketing-icons.js";

/** `circle`: bordered disc (default). `bare`: glyph only. `onMedia`: glyph on a translucent disc over imagery. */
type MarketingHeartToggleAppearance = "circle" | "bare" | "onMedia";

/** `md`: 40px visual. `sm`: 24px visual. Both keep a 44×44 hit area. */
type MarketingHeartToggleSize = "md" | "sm";

export type MarketingHeartToggleProps = {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  /** Accessible name, e.g. “Save Untitled to favorites”; state is conveyed by `aria-pressed`. */
  label: string;
  disabled?: boolean;
  /** Pending requests keep the control focusable but ignore extra presses. */
  busy?: boolean;
  appearance?: MarketingHeartToggleAppearance;
  size?: MarketingHeartToggleSize;
  className?: string;
};

/** Products opt into a saved colour with `--color-favorite`; otherwise the primary fill is kept. */
const SAVED_TEXT = "text-[color:var(--color-favorite,var(--color-primary))]";

const VISUAL_SIZE: Record<MarketingHeartToggleSize, string> = { md: "size-10", sm: "size-6" };

const GLYPH_SIZE: Record<
  MarketingHeartToggleAppearance,
  Record<MarketingHeartToggleSize, string>
> = {
  circle: { md: "size-5", sm: "size-4" },
  bare: { md: "size-7", sm: "size-6" },
  onMedia: { md: "size-5", sm: "size-4" },
};

function surfaceClass(appearance: MarketingHeartToggleAppearance, pressed: boolean): string {
  if (appearance === "bare") {
    return pressed ? SAVED_TEXT : "text-on-surface group-hover/heart:text-on-surface-variant";
  }
  if (appearance === "onMedia") {
    return cn(
      "rounded-full bg-surface/80 backdrop-blur-sm group-hover/heart:bg-surface",
      pressed ? SAVED_TEXT : "text-on-surface",
    );
  }
  return cn(
    "rounded-full border",
    pressed
      ? "border-[color:var(--color-favorite,var(--color-primary))] bg-[color:var(--color-favorite,var(--color-primary))] text-on-primary"
      : "border-outline-variant bg-surface text-on-surface group-hover/heart:bg-surface-container-low",
  );
}

/** Favourite toggle inside a 44×44 hit area (cards, detail pages). */
export const MarketingHeartToggle = forwardRef<HTMLButtonElement, MarketingHeartToggleProps>(
  function MarketingHeartToggle(
    {
      pressed,
      onPressedChange,
      label,
      disabled,
      busy = false,
      appearance = "circle",
      size = "md",
      className,
    },
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
        data-appearance={appearance}
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
            "flex items-center justify-center transition-colors motion-reduce:transition-none",
            VISUAL_SIZE[size],
            surfaceClass(appearance, pressed),
          )}
        >
          <MarketingHeartIcon
            className={cn(GLYPH_SIZE[appearance][size], pressed && "fill-current")}
            {...(appearance === "circle" ? {} : { strokeWidth: 1.5 })}
          />
        </span>
      </Button>
    );
  },
);
