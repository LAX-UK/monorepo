"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Heart } from "lucide-react";
import * as React from "react";

type WatchlistHeartProps = {
  pressed?: boolean;
  /** Called with the *next* state. */
  onChange?: (next: boolean) => void;
  /** Lot title for accessible label. */
  lotTitle?: string;
  className?: string;
  disabled?: boolean;
} & Omit<
  React.ComponentPropsWithoutRef<typeof Button>,
  "onClick" | "type" | "variant" | "children"
>;

/** F4 — Watchlist heart toggle with bump animation on click.
 *
 * - Pure CSS-driven scale on press; respects `prefers-reduced-motion` via the
 *   global cascade. SSR-safe (renders an unpressed heart on the server).
 * - Caller wires `pressed`/`onChange` to a backend mutation; this component
 *   is a presentational toggle only (SRP). Visual chrome comes from the caller.
 */
export function WatchlistHeart({
  pressed,
  onChange,
  lotTitle,
  className,
  disabled = false,
  ...rest
}: WatchlistHeartProps) {
  const [animKey, setAnimKey] = React.useState<number>(0);
  const isPressed = Boolean(pressed);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setAnimKey((k) => k + 1);
    onChange?.(!isPressed);
  }

  const label = isPressed
    ? `Remove ${lotTitle ?? "this lot"} from your watchlist`
    : `Add ${lotTitle ?? "this lot"} to your watchlist`;

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={isPressed}
      aria-label={label}
      className={cn(
        "inline-flex min-h-[var(--tap-target-min,44px)] min-w-[var(--tap-target-min,44px)] items-center justify-center rounded-full transition-colors motion-reduce:transition-none",
        disabled && "cursor-wait opacity-60",
        className,
      )}
      {...rest}
    >
      <span
        key={animKey}
        className="inline-flex motion-safe:[animation:tick_var(--motion-duration-md,_320ms)_var(--motion-ease-emphasize)]"
        aria-hidden
      >
        <Heart
          className={cn(
            "size-5 transition-[fill,stroke] motion-reduce:transition-none",
            isPressed ? "fill-live-red stroke-live-red" : "fill-transparent stroke-current",
          )}
        />
      </span>
    </Button>
  );
}
