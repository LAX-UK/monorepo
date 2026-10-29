"use client";

import { type RefObject, useEffect, useState } from "react";

export type ScrollEdges = {
  /** Content is hidden before the start (scrolled away from the left edge). */
  start: boolean;
  /** Content is hidden past the end. */
  end: boolean;
};

const NONE: ScrollEdges = { start: false, end: false };

/** Which ends of a horizontal scroller hide content, in whole pixels. */
export function readScrollEdges(el: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}): ScrollEdges {
  const hidden = el.scrollWidth - el.clientWidth;
  if (hidden <= 1) return NONE;
  return { start: el.scrollLeft > 1, end: el.scrollLeft < hidden - 1 };
}

/**
 * Tracks whether a horizontal scroller has more content to either side, so it can draw a fade at
 * that edge. Updates on scroll and when the scroller or its content changes size.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>(NONE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges((prev) => {
        const next = readScrollEdges(el);
        return prev.start === next.start && prev.end === next.end ? prev : next;
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [ref]);

  return edges;
}
