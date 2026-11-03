"use client";

import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { type ScrollEdges, useScrollEdges } from "../../hooks/use-scroll-edges.js";
import { cn } from "../../lib/utils.js";

/** Width of the edge fade, and the room the current item is kept clear of it. */
const FADE_PX = 32;

/** The item a row treats as current: a page link, a selected tab or an explicitly marked chip. */
export const SCROLL_ROW_CURRENT =
  '[aria-current]:not([aria-current="false"]), [aria-selected="true"], [data-current="true"]';

const EDGE_FADE: Record<"start" | "end" | "both", string> = {
  start: "[mask-image:linear-gradient(to_right,transparent,black_2rem)]",
  end: "[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]",
  both: "[mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]",
};

/** The fade drawn at each edge that hides more: the cue that the row scrolls. */
export function scrollRowFade({ start, end }: ScrollEdges): string | undefined {
  if (start && end) return EDGE_FADE.both;
  if (start) return EDGE_FADE.start;
  if (end) return EDGE_FADE.end;
  return undefined;
}

/** Where to scroll so `item` sits fully inside `row`, clear of the fades; null when it already does. */
export function scrollLeftToReveal(
  row: { left: number; right: number; scrollLeft: number },
  item: { left: number; right: number },
  fade = FADE_PX,
): number | null {
  const margin = fade / 2 + 8;
  if (item.left < row.left + margin) return row.scrollLeft + item.left - row.left - margin;
  if (item.right > row.right - margin) return row.scrollLeft + item.right - row.right + margin;
  return null;
}

export type ScrollRowProps<T extends ElementType> = {
  /** The element that scrolls: `div` (default) or `nav` for a navigation row. */
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

/**
 * The one horizontal scroll row of every LAX product, for tabs, chips, letters and links that do
 * not all fit on a phone. It never shows a scrollbar; it fades the edge that hides more, so the
 * row reads as scrollable; it keeps the current item in view (and clear of the fade) when it
 * appears or changes; and it scrolls keyboard-focused items clear of the fade. Put the items in
 * a single child that is as wide as they are.
 */
export function ScrollRow<T extends ElementType = "div">({
  as,
  children,
  className,
  ...rest
}: ScrollRowProps<T>) {
  const Tag: ElementType = as ?? "div";
  const ref = useRef<HTMLElement>(null);
  const edges = useScrollEdges(ref);
  const revealed = useRef<Element | null>(null);

  // Runs after every render but scrolls only when the current item is a new one, so a row the
  // person has scrolled by hand is never pulled back by an unrelated update.
  useEffect(() => {
    const row = ref.current;
    const current = row?.querySelector(SCROLL_ROW_CURRENT) ?? null;
    if (!row || current === revealed.current) return;
    revealed.current = current;
    if (!current) return;
    const box = row.getBoundingClientRect();
    const left = scrollLeftToReveal(
      { left: box.left, right: box.right, scrollLeft: row.scrollLeft },
      current.getBoundingClientRect(),
    );
    if (left !== null) row.scrollLeft = Math.max(0, left);
  });

  return (
    <Tag
      ref={ref}
      data-scroll-row
      className={cn(
        "min-w-0 max-w-full overflow-x-auto overscroll-x-contain scroll-px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        scrollRowFade(edges),
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
