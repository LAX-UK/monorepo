"use client";

import { useEffect, useRef } from "react";

/** Restores focus to the element that was active before opening an overlay. */
export function useGalleryFocusReturn(active: boolean) {
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const capture = () => {
    lastFocusRef.current = document.activeElement as HTMLElement | null;
  };

  useEffect(() => {
    if (active) return;
    const t = window.setTimeout(() => {
      lastFocusRef.current?.focus?.();
    }, 0);
    return () => window.clearTimeout(t);
  }, [active]);

  return { capture };
}
