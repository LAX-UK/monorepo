"use client";

import { useEffect } from "react";

/** The LAX top bar's height; the header slides up by at most this much as the page scrolls. */
export const TOP_BAR_HEIGHT_PX = 36;

/** The custom property the header's transform reads. */
export const TOP_BAR_SHIFT_VAR = "--lax-top-bar-shift";

/**
 * Lets the 36px LAX top bar scroll away while the main row stays: it publishes how far the page
 * has scrolled (capped at the bar's height) on the header, and the header's `lg:` transform
 * moves it up by that much. The header keeps its full height for content offsets, so nothing
 * on the page moves. Below `lg` there is no top bar and the shift has no effect.
 */
export function useTopBarScrollAway(header: { current: HTMLElement | null }): void {
  useEffect(() => {
    let frame = 0;
    const apply = () => {
      frame = 0;
      const el = header.current;
      if (!el) return;
      const shift = Math.min(Math.max(window.scrollY, 0), TOP_BAR_HEIGHT_PX);
      el.style.setProperty(TOP_BAR_SHIFT_VAR, `${shift}px`);
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [header]);
}
