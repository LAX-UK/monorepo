"use client";

import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import { overlayPillClasses, overlayToneProps } from "@/lib/ui/overlay-tone-classes";
import type { PositionIndicatorProps } from "@auction/types";
import { formatGalleryIndex } from "@auction/types";
import { cn } from "@auction/ui";

type Props = PositionIndicatorProps & {
  liveId?: string;
};

/** Always-visible "01 / 40" position pill (Christie's-style). */
export function CounterPill({ total, index, className, liveId }: Props) {
  if (total <= 1) return null;

  const label = formatGalleryIndex(index, total);
  const tone = useOverlayTone("topRight");

  return (
    <>
      <p
        className={cn(
          overlayPillClasses(tone),
          "pointer-events-none absolute top-4 z-10 rounded-full px-3 py-1.5 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] shadow-md",
          "right-4 md:left-4 md:right-auto",
          className,
        )}
        {...overlayToneProps(tone)}
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
