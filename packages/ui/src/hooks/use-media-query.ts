"use client";

import * as React from "react";

/** Tailwind `md` breakpoint — keep in sync with responsive picker shells. */
export const MD_MIN_WIDTH_QUERY = "(min-width: 768px)";

/**
 * Subscribes to a CSS media query. Returns `null` until the client has measured
 * (avoids mounting the wrong portaled overlay during SSR/hydration).
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);

  return matches;
}

export function useMinWidthMd(): boolean | null {
  return useMediaQuery(MD_MIN_WIDTH_QUERY);
}
