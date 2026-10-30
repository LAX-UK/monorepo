"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { MarketingCarouselNextIcon, MarketingCarouselPreviousIcon } from "./marketing-icons.js";

export type MarketingHorizontalRailScrollerTag = "ul" | "section" | "div";

export type MarketingHorizontalRailControls = "forward-only" | "arrows-progress";

/**
 * `overlay`: arrows over the rail's ends, progress under it. `below`: one row under the rail with
 * the back arrow, the progress and the forward arrow (Figma Art Hub carousels, `992:14233`). Both
 * arrows stay in place and disable at the ends, so the row never shifts.
 */
export type MarketingHorizontalRailControlsPlacement = "overlay" | "below";

export type MarketingHorizontalRailProps = {
  id: string;
  ariaLabel: string;
  forwardAriaLabel: string;
  backAriaLabel?: string;
  controls?: MarketingHorizontalRailControls;
  /** Only with `arrows-progress`; defaults to `overlay`. */
  controlsPlacement?: MarketingHorizontalRailControlsPlacement;
  /** Fades the trailing edge while more items wait off screen; off for full-bleed peek rails. */
  edgeFade?: boolean;
  scrollerAs?: MarketingHorizontalRailScrollerTag;
  scrollerClassName?: string;
  forwardButtonClassName?: string;
  wrapperClassName?: string;
  children: ReactNode;
};

const END_OVERFLOW_EPSILON = 4;
const FORWARD_SCROLL_RATIO = 0.75;

const RAIL_BUTTON_BASE_CLASS =
  "pointer-events-auto absolute top-1/2 z-[2] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface shadow-sm outline-offset-2 hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:flex dark:bg-surface-container-low dark:hover:bg-surface-container";

const DEFAULT_FORWARD_BUTTON_CLASS = cn(RAIL_BUTTON_BASE_CLASS, "right-0");
const DEFAULT_BACK_BUTTON_CLASS = cn(RAIL_BUTTON_BASE_CLASS, "left-0");

/** In-flow arrows under the rail: shown at every width, quiet (not hidden) at the ends. */
const BELOW_BUTTON_CLASS =
  "size-11 shrink-0 rounded-full border border-outline-variant bg-surface text-on-surface outline-offset-2 hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:border-border-hairline disabled:bg-transparent disabled:text-on-surface-variant disabled:opacity-100 dark:bg-surface-container-low dark:hover:bg-surface-container";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Thin track with the scrolled share filled; decorative, the arrows carry the meaning. */
function RailProgress({ progress, className }: { progress: number; className?: string }) {
  return (
    <div
      className={cn("h-0.5 overflow-hidden rounded-full bg-outline-variant/40", className)}
      aria-hidden
      data-testid="marketing-rail-progress"
    >
      <div
        className="h-full bg-on-surface transition-[width] duration-[var(--motion-duration-fast,150ms)] motion-reduce:transition-none"
        style={{ width: `${Math.max(8, Math.round(progress * 100))}%` }}
      />
    </div>
  );
}

export function MarketingHorizontalRail({
  id,
  ariaLabel,
  forwardAriaLabel,
  backAriaLabel = "Scroll back",
  controls = "forward-only",
  controlsPlacement = "overlay",
  edgeFade = true,
  scrollerAs = "div",
  scrollerClassName,
  forwardButtonClassName,
  wrapperClassName,
  children,
}: MarketingHorizontalRailProps) {
  const scrollerRef = useRef<HTMLDivElement | HTMLUListElement | HTMLElement | null>(null);
  const [canScrollEnd, setCanScrollEnd] = useState(false);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const showArrows = controls === "arrows-progress";
  const below = showArrows && controlsPlacement === "below";

  const updateScrollHint = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setCanScrollEnd(
      maxScroll > END_OVERFLOW_EPSILON && scrollLeft < maxScroll - END_OVERFLOW_EPSILON,
    );
    setCanScrollStart(scrollLeft > END_OVERFLOW_EPSILON);
    setScrollProgress(maxScroll > 0 ? Math.min(1, Math.max(0, scrollLeft / maxScroll)) : 0);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollHint();
    const ro = new ResizeObserver(() => updateScrollHint());
    ro.observe(el);
    el.addEventListener("scroll", updateScrollHint, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateScrollHint);
    };
  }, [updateScrollHint]);

  function scrollByDirection(direction: "forward" | "back") {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.round(el.clientWidth * FORWARD_SCROLL_RATIO);
    el.scrollBy({
      left: direction === "forward" ? delta : -delta,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  // Card reveals translate children below the row; a vertically scrollable rail would swallow page scroll.
  const scrollerProps = {
    id,
    className: cn("overflow-y-hidden overscroll-x-contain", scrollerClassName),
    "aria-label": ariaLabel,
    "data-lenis-prevent-horizontal": true,
    children,
  };

  const backButton = (className: string) => (
    <Button
      type="button"
      variant="ghost"
      onClick={() => scrollByDirection("back")}
      className={className}
      aria-label={backAriaLabel}
      aria-controls={id}
      {...(below ? { disabled: !canScrollStart } : {})}
    >
      <MarketingCarouselPreviousIcon />
    </Button>
  );
  const forwardButton = (className: string) => (
    <Button
      type="button"
      variant="ghost"
      onClick={() => scrollByDirection("forward")}
      className={className}
      aria-label={forwardAriaLabel}
      aria-controls={id}
      {...(below ? { disabled: !canScrollEnd } : {})}
    >
      <MarketingCarouselNextIcon />
    </Button>
  );
  const scrollable = canScrollStart || canScrollEnd;

  return (
    <div className={cn("relative", wrapperClassName)}>
      {scrollerAs === "ul" ? (
        <ul {...scrollerProps} ref={scrollerRef as RefObject<HTMLUListElement>} />
      ) : scrollerAs === "section" ? (
        <section {...scrollerProps} ref={scrollerRef as RefObject<HTMLElement>} />
      ) : (
        <div {...scrollerProps} ref={scrollerRef as RefObject<HTMLDivElement>} />
      )}
      {edgeFade && canScrollEnd ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-16 bg-gradient-to-l from-page-bg via-page-bg/90 to-transparent sm:block"
          aria-hidden
        />
      ) : null}
      {below ? (
        scrollable ? (
          <div
            className="mt-6 flex items-center justify-center gap-4 px-4 sm:mt-8 sm:gap-6"
            data-testid="marketing-rail-controls"
          >
            {backButton(BELOW_BUTTON_CLASS)}
            <RailProgress progress={scrollProgress} className="w-full max-w-xs sm:max-w-md" />
            {forwardButton(BELOW_BUTTON_CLASS)}
          </div>
        ) : null
      ) : (
        <>
          {showArrows && canScrollStart ? backButton(DEFAULT_BACK_BUTTON_CLASS) : null}
          {canScrollEnd
            ? forwardButton(cn(DEFAULT_FORWARD_BUTTON_CLASS, forwardButtonClassName))
            : null}
          {showArrows && scrollable ? (
            <RailProgress
              progress={scrollProgress}
              className="mx-auto mt-6 hidden max-w-xs sm:block"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
