"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

const END_EPSILON = 4;
/** One press of an arrow button moves this share of the visible width. */
const PAGE_RATIO = 0.75;
/** One press of an arrow key moves this many pixels, as a browser's own arrow scroll would. */
const KEY_STEP_PX = 160;

function scrollBehavior(): ScrollBehavior {
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduced ? "auto" : "smooth";
}

export type HangScroll = {
  ref: React.RefObject<HTMLElement | null>;
  /** More of the row waits off screen to the left. */
  canScrollStart: boolean;
  /** More of the row waits off screen to the right. */
  canScrollEnd: boolean;
  scrollPage: (direction: "start" | "end") => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

/**
 * Scroll state for the hang's row: where more can scroll, page buttons, and the arrow, Home and
 * End keys for a focused row. Browsers scroll a focused overflow region with the arrow keys
 * already, but not in every engine and not with the same step, so the row handles them itself.
 */
export function useHangScroll(): HangScroll {
  const ref = useRef<HTMLElement | null>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollStart(el.scrollLeft > END_EPSILON);
    setCanScrollEnd(max > END_EPSILON && el.scrollLeft < max - END_EPSILON);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  const scrollPage = useCallback((direction: "start" | "end") => {
    const el = ref.current;
    if (!el) return;
    const delta = Math.round(el.clientWidth * PAGE_RATIO);
    el.scrollBy({ left: direction === "end" ? delta : -delta, behavior: scrollBehavior() });
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || event.target !== el) return;
    if (event.key === "ArrowRight") {
      el.scrollBy({ left: KEY_STEP_PX, behavior: scrollBehavior() });
    } else if (event.key === "ArrowLeft") {
      el.scrollBy({ left: -KEY_STEP_PX, behavior: scrollBehavior() });
    } else if (event.key === "Home") {
      el.scrollTo({ left: 0, behavior: scrollBehavior() });
    } else if (event.key === "End") {
      el.scrollTo({ left: el.scrollWidth, behavior: scrollBehavior() });
    } else {
      return;
    }
    event.preventDefault();
  }, []);

  return { ref, canScrollStart, canScrollEnd, scrollPage, onKeyDown };
}
