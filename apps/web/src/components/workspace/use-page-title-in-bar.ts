"use client";

import { usePathname } from "next/navigation";
import { type RefObject, useEffect, useState } from "react";

/**
 * The phone bar's title: once the page's large title (`[data-page-title]`) scrolls out of the
 * main area, its text moves into the bar; scrolling back up hands it back. Pages without a large
 * title keep the bar as it is.
 */
export function usePageTitleInBar(mainRef: RefObject<HTMLElement | null>): string | null {
  const pathname = usePathname();
  const [title, setTitle] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new page has a new title to watch
  useEffect(() => {
    setTitle(null);
    const main = mainRef.current;
    const heading = main?.querySelector<HTMLElement>("[data-page-title]");
    if (!main || !heading || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setTitle(entry && !entry.isIntersecting ? (heading.textContent?.trim() ?? null) : null);
      },
      { root: main, threshold: 0 },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [pathname, mainRef]);
  return title;
}
