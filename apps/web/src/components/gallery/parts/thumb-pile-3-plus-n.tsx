"use client";

import type { PositionIndicatorProps } from "@auction/types";
import { Button, cn } from "@auction/ui";

const MAX_VISIBLE = 3;
const TAP_MIN = "min-h-11 min-w-11";

type Props = PositionIndicatorProps;

/** Windowed dot pile: at most 3 small dots + "+N" for the rest. */
export function ThumbPile3PlusN({ total, index, onSelect, onOverflow, className }: Props) {
  if (total <= 1) return null;

  if (total <= MAX_VISIBLE) {
    return (
      <div
        className={cn("pointer-events-auto flex gap-1", className)}
        role="group"
        aria-label="Image position"
      >
        {Array.from({ length: total }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable dot index for position controls
          <ThumbDot key={i} i={i} total={total} active={i === index} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  const windowIndices = windowedIndices(index, total, MAX_VISIBLE);
  const overflowCount = total - MAX_VISIBLE;

  return (
    <div
      className={cn("pointer-events-auto flex items-center gap-1", className)}
      role="group"
      aria-label="Image position"
    >
      {windowIndices.map((i) => (
        <ThumbDot key={i} i={i} total={total} active={i === index} onSelect={onSelect} />
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          TAP_MIN,
          "rounded-full bg-white/50 px-3 font-label text-xs font-bold text-on-surface hover:bg-white/80",
        )}
        aria-label={`View all ${total} images`}
        onClick={() => onOverflow?.()}
      >
        +{overflowCount}
      </Button>
    </div>
  );
}

function windowedIndices(current: number, total: number, max: number): number[] {
  if (total <= max) {
    return Array.from({ length: total }, (_, i) => i);
  }
  let start = Math.max(0, current - 1);
  if (start + max > total) start = total - max;
  return Array.from({ length: max }, (_, j) => start + j);
}

function ThumbDot({
  i,
  total,
  active,
  onSelect,
}: {
  i: number;
  total: number;
  active: boolean;
  onSelect: (i: number) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Show image ${i + 1} of ${total}`}
      aria-current={active ? "true" : undefined}
      onClick={() => onSelect(i)}
      className={cn(
        TAP_MIN,
        "rounded-full p-0 hover:bg-transparent",
        active ? "bg-primary hover:bg-primary" : "bg-white/50 hover:bg-white/80",
      )}
    >
      <span
        className={cn("block h-2.5 w-2.5 rounded-full", active ? "bg-white" : "bg-on-surface")}
        aria-hidden
      />
    </Button>
  );
}
