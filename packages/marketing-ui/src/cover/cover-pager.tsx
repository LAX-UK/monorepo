"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/lax";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ON_IMAGE_BUTTON } from "./cover-on-image.js";
import { slidePosition } from "./cover-sources.js";
import type { CoverTone } from "./cover-types.js";

/**
 * Previous, "1 of 3" and next for several pinned sales. Nothing moves by itself, so there is no
 * pause control: the person decides when the cover changes.
 */
export function CoverPager({
  index,
  count,
  tone,
  onStep,
  className,
}: {
  index: number;
  count: number;
  /** The tone of the picture the pager sits on; null on the page's own surface. */
  tone: CoverTone | null;
  onStep: (direction: 1 | -1) => void;
  className?: string;
}) {
  const onImage = tone ? ON_IMAGE_BUTTON[tone] : "";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label="Previous sale"
        className={onImage}
        onClick={() => onStep(-1)}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <p
        aria-live="polite"
        className="min-w-12 text-center font-body text-xs font-medium leading-4 tabular-nums text-on-surface-variant md:text-[color:var(--cover-credit)]"
      >
        {slidePosition(index, count)}
      </p>
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label="Next sale"
        className={onImage}
        onClick={() => onStep(1)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
