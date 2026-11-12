"use client";

import { type RefObject, useEffect, useState } from "react";

/** One viewport above and below the screen: far enough that a fetch finishes before it is needed. */
export const NEAR_VIEWPORT_MARGIN = "100% 0px";

/**
 * Whether the element has come within `rootMargin` of the viewport. It starts `false` and, once
 * `true`, stays `true`: the answer is used to start a one-off fetch, not to follow the element.
 * Without `IntersectionObserver` it answers `true` at once, so nothing waits for a signal that
 * will not come.
 */
export function useNearViewport(
  target: RefObject<Element | null>,
  rootMargin: string = NEAR_VIEWPORT_MARGIN,
): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near) return;
    const element = target.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near, target, rootMargin]);
  return near;
}
