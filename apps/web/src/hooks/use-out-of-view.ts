"use client";

import { type RefObject, useEffect, useState } from "react";

/**
 * Whether the element is out of the viewport, so a bar can stand in for it. It starts as `false`
 * (nothing shows before the first reading) and follows the element as the page scrolls. The bottom
 * margin treats the strip the fixed bar will occupy as already covered, so the bar showing never
 * changes the reading and the two cannot flicker.
 */
export function useOutOfView(target: RefObject<Element | null>, coveredBottomPx: number): boolean {
  const [outOfView, setOutOfView] = useState(false);
  useEffect(() => {
    const element = target.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setOutOfView(entry ? !entry.isIntersecting : false),
      { rootMargin: `0px 0px -${coveredBottomPx}px 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [target, coveredBottomPx]);
  return outOfView;
}
