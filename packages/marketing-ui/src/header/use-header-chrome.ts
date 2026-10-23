"use client";

import { cn } from "@auction/ui";
import {
  type RefCallback,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { MarketingHeaderTone } from "./header-chrome-tone.js";

/** Scroll distance below which the page still counts as "at the top". */
export const HEADER_SCROLL_FADE_THRESHOLD_PX = 12;

export type UseHeaderChromeOptions = {
  /** True on routes whose first section is a full-bleed hero the header should sit over. */
  transparent: boolean;
  /** True while a mega menu, search shelf or mobile menu is open; the header is then always solid. */
  overlayOpen: boolean;
  /** Called after `--header-height` changes, for apps that position other chrome from it. */
  onHeightChange?: (height: number) => void;
};

export type HeaderChrome = {
  /** Transparent right now: transparent route, at the top of the page, nothing open. */
  isTransparent: boolean;
  atTop: boolean;
  /** Tone for the logo, nav and icons so they stay legible on the hero image. */
  headerTone: MarketingHeaderTone;
  /** Holds the `<header>` element once `attachHeader` has run. */
  headerRef: RefObject<HTMLElement | null>;
  /** Pass as the header's `ref`; keeps `--header-height` in step with the element. */
  attachHeader: RefCallback<HTMLElement>;
};

/**
 * Behaviour shared by the Bid, Shop and Art headers: transparent over a hero until the page
 * scrolls, solid otherwise, and `--header-height` published for content offsets.
 */
export function useHeaderChrome({
  transparent,
  overlayOpen,
  onHeightChange,
}: UseHeaderChromeOptions): HeaderChrome {
  const [atTop, setAtTop] = useState(true);
  const headerRef = useRef<HTMLElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastHeightRef = useRef(0);
  const onHeightChangeRef = useRef(onHeightChange);
  onHeightChangeRef.current = onHeightChange;

  const attachHeader = useCallback((el: HTMLElement | null) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    headerRef.current = el;
    if (!el) return;

    const sync = () => {
      const height = el.offsetHeight;
      if (height === lastHeightRef.current) return;
      lastHeightRef.current = height;
      document.documentElement.style.setProperty("--header-height", `${height}px`);
      onHeightChangeRef.current?.(height);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    resizeObserverRef.current = observer;
  }, []);

  useLayoutEffect(() => {
    if (!transparent) {
      setAtTop(true);
      return;
    }
    const onScroll = () => setAtTop(window.scrollY <= HEADER_SCROLL_FADE_THRESHOLD_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  const isTransparent = transparent && atTop && !overlayOpen;
  return {
    isTransparent,
    atTop,
    headerTone: isTransparent ? "on-dark" : "on-light",
    headerRef,
    attachHeader,
  };
}

/**
 * Surface classes for the fixed header. The transition is dropped under reduced motion so the
 * header switches state without animating.
 */
export function headerChromeClassName(isTransparent: boolean, megaOpen: boolean): string {
  return cn(
    "fixed top-0 z-50 w-full border-b pt-[env(safe-area-inset-top,0px)] transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out motion-reduce:transition-none",
    isTransparent
      ? "border-transparent bg-transparent"
      : cn(
          "border-nav-border bg-surface shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-surface",
          megaOpen && "border-transparent shadow-none backdrop-blur-none",
        ),
  );
}
