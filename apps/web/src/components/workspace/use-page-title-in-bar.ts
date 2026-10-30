"use client";

import { usePathname } from "next/navigation";
import { type RefObject, useEffect, useState } from "react";

/**
 * Whether the page's large title (`[data-page-title]`) has scrolled out above the main area. The
 * title is looked up on each scroll, so a page that streams in after its loading state is read
 * as it is now, not as it was when the page opened.
 */
export function largeTitleScrolledAway(main: HTMLElement): string | null {
  const heading = main.querySelector<HTMLElement>("[data-page-title]");
  // A title the page hides is not a large title: the bar keeps its lockup.
  if (!heading || heading.getClientRects().length === 0) return null;
  const gone = heading.getBoundingClientRect().bottom <= main.getBoundingClientRect().top;
  return gone ? (heading.textContent?.trim() ?? null) : null;
}

/**
 * The phone bar's title: once the page's large title scrolls out of the main area, its text
 * moves into the bar; scrolling back up hands it back.
 */
export function usePageTitleInBar(mainRef: RefObject<HTMLElement | null>): string | null {
  const pathname = usePathname();
  const [title, setTitle] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new page starts with its title in place
  useEffect(() => {
    setTitle(null);
    const main = mainRef.current;
    if (!main) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTitle(largeTitleScrolledAway(main)));
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      main.removeEventListener("scroll", onScroll);
    };
  }, [pathname, mainRef]);
  return title;
}
