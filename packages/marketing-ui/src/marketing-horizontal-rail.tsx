"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { MarketingCarouselNextIcon } from "./marketing-icons.js";

export type MarketingHorizontalRailScrollerTag = "ul" | "section" | "div";

export type MarketingHorizontalRailProps = {
  id: string;
  ariaLabel: string;
  forwardAriaLabel: string;
  scrollerAs?: MarketingHorizontalRailScrollerTag;
  scrollerClassName?: string;
  forwardButtonClassName?: string;
  wrapperClassName?: string;
  children: ReactNode;
};

const END_OVERFLOW_EPSILON = 4;
const FORWARD_SCROLL_RATIO = 0.75;

const DEFAULT_FORWARD_BUTTON_CLASS =
  "pointer-events-auto absolute right-0 top-1/2 z-[2] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface shadow-sm outline-offset-2 hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:flex dark:bg-surface-container-low dark:hover:bg-surface-container";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MarketingHorizontalRail({
  id,
  ariaLabel,
  forwardAriaLabel,
  scrollerAs = "div",
  scrollerClassName,
  forwardButtonClassName,
  wrapperClassName,
  children,
}: MarketingHorizontalRailProps) {
  const scrollerRef = useRef<HTMLDivElement | HTMLUListElement | HTMLElement | null>(null);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const updateScrollHint = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setCanScrollEnd(
      maxScroll > END_OVERFLOW_EPSILON && scrollLeft < maxScroll - END_OVERFLOW_EPSILON,
    );
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

  function scrollForward() {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.round(el.clientWidth * FORWARD_SCROLL_RATIO);
    el.scrollBy({ left: delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
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
      {canScrollEnd ? (
        <Button
          type="button"
          variant="ghost"
          onClick={scrollForward}
          className={cn(DEFAULT_FORWARD_BUTTON_CLASS, forwardButtonClassName)}
          aria-label={forwardAriaLabel}
          aria-controls={id}
        >
          <MarketingCarouselNextIcon />
        </Button>
      ) : null}
    </div>
  );
}
