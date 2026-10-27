"use client";

import * as React from "react";
import { cn } from "../lib/cn.js";

export type ScrollEdges = { top: boolean; bottom: boolean };

/** Which edges of a scroll container have more content past them. */
export function scrollEdges(el: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): ScrollEdges {
  const slack = 1;
  return {
    top: el.scrollTop > slack,
    bottom: el.scrollTop + el.clientHeight < el.scrollHeight - slack,
  };
}

const FADE =
  "pointer-events-none absolute inset-x-0 z-10 h-8 transition-opacity duration-150 motion-reduce:transition-none";

/**
 * The navigation's scroll container. When pages run past the viewport (short laptop screens, many
 * groups) the edge with more pages fades out, so a cut-off group reads as "scroll for more"
 * rather than as the end of the list.
 */
export function NavScrollArea({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState<ScrollEdges>({ top: false, bottom: false });

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = scrollEdges(el);
    setEdges((prev) => (prev.top === next.top && prev.bottom === next.bottom ? prev : next));
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [update]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={ref}
        onScroll={update}
        className={cn("h-full overflow-y-auto overflow-x-hidden [scrollbar-width:thin]", className)}
      >
        <div>{children}</div>
      </div>
      <span
        aria-hidden
        data-fade="top"
        className={cn(
          FADE,
          "top-0 bg-[linear-gradient(to_bottom,var(--color-staff-sunken),transparent)]",
          edges.top ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden
        data-fade="bottom"
        className={cn(
          FADE,
          "bottom-0 bg-[linear-gradient(to_top,var(--color-staff-sunken),transparent)]",
          edges.bottom ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
