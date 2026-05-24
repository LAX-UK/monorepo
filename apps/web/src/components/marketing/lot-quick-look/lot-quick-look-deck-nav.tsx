"use client";

import { cn } from "@auction/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  deckIndex: number;
  deckLength: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
  /** `hero-overlay` flanks the hero image on desktop; `inline` is the default row layout. */
  variant?: "inline" | "hero-overlay";
};

const navButtonClass =
  "inline-flex size-11 items-center justify-center rounded-full border border-outline-variant/40 bg-surface/90 text-on-surface shadow-sm backdrop-blur transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function LotQuickLookDeckNav({
  deckIndex,
  deckLength,
  onPrev,
  onNext,
  className,
  variant = "inline",
}: Props) {
  if (deckLength <= 1) return null;

  const label = `${deckIndex + 1} of ${deckLength}`;

  if (variant === "hero-overlay") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 right-0 z-10 hidden items-center justify-between px-2 lg:flex",
          className,
        )}
        aria-label="Browse related lots"
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={deckIndex <= 0}
          className={cn(navButtonClass, "pointer-events-auto")}
          aria-label="Previous lot"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={deckIndex >= deckLength - 1}
          className={cn(navButtonClass, "pointer-events-auto")}
          aria-label="Next lot"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center justify-between gap-3", className)}
      aria-label="Browse related lots"
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={deckIndex <= 0}
        className={navButtonClass}
        aria-label="Previous lot"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <span className="font-body text-sm tabular-nums text-on-surface-variant">{label}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={deckIndex >= deckLength - 1}
        className={navButtonClass}
        aria-label="Next lot"
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}
