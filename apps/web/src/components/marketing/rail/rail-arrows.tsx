"use client";

import { Button } from "@auction/ui/lax";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Props = {
  /** The id of the scroll region these arrows move. */
  targetId: string;
  /** What the rail holds, used in the button names: "lots" gives "Previous lots". */
  noun: string;
};

type Edges = { atStart: boolean; atEnd: boolean; overflows: boolean };

const NO_OVERFLOW: Edges = { atStart: true, atEnd: true, overflows: false };

function readEdges(el: HTMLElement): Edges {
  const max = el.scrollWidth - el.clientWidth;
  return {
    overflows: max > 1,
    atStart: el.scrollLeft <= 1,
    atEnd: el.scrollLeft >= max - 1,
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * The arrow pair for a scrolling rail, set in the section header beside "View all". Each end
 * shows the arrow disabled but focusable, with the reason on hover and focus. A rail that fits
 * its row shows no arrows, and on touch screens swiping is native, so they are not drawn.
 */
export function RailArrows({ targetId, noun }: Props) {
  const [edges, setEdges] = useState<Edges>(NO_OVERFLOW);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const update = () => setEdges(readEdges(el));
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [targetId]);

  const scroll = useCallback(
    (direction: 1 | -1) => {
      const el = document.getElementById(targetId);
      if (!el) return;
      el.scrollBy({
        left: direction * el.clientWidth * 0.9,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    },
    [targetId],
  );

  if (!edges.overflows) return null;

  return (
    <div className="flex items-center gap-2 pointer-coarse:hidden">
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label={`Previous ${noun}`}
        aria-controls={targetId}
        {...(edges.atStart ? { disabledReason: "You are at the start" } : {})}
        onClick={() => scroll(-1)}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label={`Next ${noun}`}
        aria-controls={targetId}
        {...(edges.atEnd ? { disabledReason: "You are at the end" } : {})}
        onClick={() => scroll(1)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
