"use client";

import { Button } from "@auction/ui/lax";
import { ChevronLeft, ChevronRight } from "lucide-react";

type MarketingHangArrowsProps = {
  controls: string;
  canScrollStart: boolean;
  canScrollEnd: boolean;
  onPage: (direction: "start" | "end") => void;
  previousLabel: string;
  nextLabel: string;
};

/** The previous and next pair beside "See all": the kit's 32px secondary icon buttons. */
export function MarketingHangArrows({
  controls,
  canScrollStart,
  canScrollEnd,
  onPage,
  previousLabel,
  nextLabel,
}: MarketingHangArrowsProps) {
  return (
    <span className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label={previousLabel}
        aria-controls={controls}
        disabled={!canScrollStart}
        onClick={() => onPage("start")}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label={nextLabel}
        aria-controls={controls}
        disabled={!canScrollEnd}
        onClick={() => onPage("end")}
      >
        <ChevronRight aria-hidden />
      </Button>
    </span>
  );
}
