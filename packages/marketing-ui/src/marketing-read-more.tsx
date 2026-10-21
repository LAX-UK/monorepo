"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { MarketingChevronDownIcon } from "./marketing-icons.js";

export type MarketingReadMoreProps = {
  children: ReactNode;
  /** Lines shown while collapsed. */
  lines?: number;
  className?: string;
};

/**
 * Clamps long copy with CSS and offers "Read more" only when the text actually overflows.
 * Without JavaScript the copy stays clamped; the toggle appears after hydration measures it.
 */
export function MarketingReadMore({ children, lines = 3, className }: MarketingReadMoreProps) {
  const contentId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <div className={className}>
      <div
        id={contentId}
        ref={contentRef}
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: lines,
                overflow: "hidden",
              }
        }
      >
        {children}
      </div>
      {overflows || expanded ? (
        <Button
          type="button"
          variant="ghost"
          size="inline"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((open) => !open)}
          className={cn(
            "mt-1 gap-1 rounded-sm bg-transparent text-sm font-medium text-on-surface hover:bg-transparent hover:underline",
            FOCUS_RING,
          )}
        >
          {expanded ? "Read less" : "Read more"}
          <MarketingChevronDownIcon
            className={cn(
              "size-4 motion-safe:transition-transform motion-safe:duration-200",
              expanded && "rotate-180",
            )}
          />
        </Button>
      ) : null}
    </div>
  );
}
