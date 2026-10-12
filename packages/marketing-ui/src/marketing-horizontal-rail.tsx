"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { MarketingCarouselNextIcon, MarketingCarouselPreviousIcon } from "./marketing-icons.js";

export type MarketingHorizontalRailScrollerTag = "ul" | "section" | "div";

export type MarketingHorizontalRailControls = "forward-only" | "arrows-progress";

export type MarketingHorizontalRailProps = {
  id: string;
  ariaLabel: string;
  forwardAriaLabel: string;
  backAriaLabel?: string;
  controls?: MarketingHorizontalRailControls;
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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MarketingHorizontalRail({
  id,
  ariaLabel,
  forwardAriaLabel,
  backAriaLabel = "Scroll back",
  controls = "forward-only",
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

  const scrollerProps = {
    id,
    className: scrollerClassName,
    "aria-label": ariaLabel,
    children,
  };

  return (
    <div className={cn("relative", wrapperClassName)}>
      {scrollerAs === "ul" ? (
        <ul {...scrollerProps} ref={scrollerRef as RefObject<HTMLUListElement>} />
      ) : scrollerAs === "section" ? (
        <section {...scrollerProps} ref={scrollerRef as RefObject<HTMLElement>} />
      ) : (
        <div {...scrollerProps} ref={scrollerRef as RefObject<HTMLDivElement>} />
      )}
      {canScrollEnd ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-16 bg-gradient-to-l from-page-bg via-page-bg/90 to-transparent sm:block"
          aria-hidden
        />
      ) : null}
      {showArrows && canScrollStart ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => scrollByDirection("back")}
          className={DEFAULT_BACK_BUTTON_CLASS}
          aria-label={backAriaLabel}
          aria-controls={id}
        >
          <MarketingCarouselPreviousIcon />
        </Button>
      ) : null}
      {canScrollEnd ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => scrollByDirection("forward")}
          className={cn(DEFAULT_FORWARD_BUTTON_CLASS, forwardButtonClassName)}
          aria-label={forwardAriaLabel}
          aria-controls={id}
        >
          <MarketingCarouselNextIcon />
        </Button>
      ) : null}
      {showArrows && (canScrollStart || canScrollEnd) ? (
        <div
          className="mx-auto mt-6 hidden h-0.5 max-w-xs overflow-hidden rounded-full bg-outline-variant/40 sm:block"
          aria-hidden
        >
          <div
            className="h-full bg-on-surface transition-[width] duration-[var(--motion-duration-fast,150ms)] motion-reduce:transition-none"
            style={{ width: `${Math.max(8, Math.round(scrollProgress * 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
