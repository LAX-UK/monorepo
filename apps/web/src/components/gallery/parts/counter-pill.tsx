"use client";

import type { PositionIndicatorProps } from "@auction/types";
import { formatGalleryIndex } from "@auction/types";
import { cn } from "@auction/ui";

type Props = PositionIndicatorProps & {
  /** Screen-reader live region id when paired with a hero region. */
  liveId?: string;
};

/** Always-visible "01 / 40" position pill (Christie's-style). */
export function CounterPill({ total, index, className, liveId }: Props) {
  if (total <= 1) return null;

  const label = formatGalleryIndex(index, total);

  return (
    <>
      <p
        className={cn(
          "pointer-events-none absolute top-4 z-10 rounded-full bg-surface-container-lowest/90 px-3 py-1.5 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface shadow-md backdrop-blur-sm",
          "right-4 md:left-4 md:right-auto",
          className,
        )}
        aria-hidden
      >
        {label}
      </p>
      <p id={liveId} className="sr-only" aria-live="polite" aria-atomic="true">
        Image {index + 1} of {total}
      </p>
    </>
  );
}
