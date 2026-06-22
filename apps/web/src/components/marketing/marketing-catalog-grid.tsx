import { sparseGridClasses } from "@/lib/ui/sparse-grid-classes";
import { cn } from "@auction/ui";
import type { ReactElement, ReactNode } from "react";
import { Children, isValidElement } from "react";

export type MarketingCatalogGridProps = {
  /** Item count — drives sparse responsive column classes. */
  count: number;
  /** Tailwind classes for 3+ items (must include `grid` + column breakpoints). */
  multi: string;
  /** Optional override for a single centered item. */
  single?: string;
  /** Optional override for exactly two items. */
  pair?: string;
  children: ReactNode;
  className?: string;
  /** Gap / list reset classes applied alongside equal-height grid behaviour. */
  gridClassName?: string;
  /** List item wrapper classes (defaults to stretch-ready flex column). */
  itemClassName?: string;
  as?: "ul" | "section";
  /** Accessible name for the list when children are interactive tiles. */
  ariaLabel?: string;
};

/**
 * Canonical marketing catalogue grid: sparse columns + equal row heights.
 * Each child is wrapped in a stretch-ready `<li>` (preserves child `key` when set).
 */
export function MarketingCatalogGrid({
  count,
  multi,
  single,
  pair,
  children,
  className,
  gridClassName,
  itemClassName,
  as: Tag = "ul",
  ariaLabel,
}: MarketingCatalogGridProps): ReactElement {
  return (
    <Tag
      aria-label={ariaLabel}
      className={cn(
        "list-none auto-rows-fr items-stretch justify-items-stretch p-0",
        sparseGridClasses(count, {
          multi,
          ...(single ? { single } : {}),
          ...(pair ? { pair } : {}),
        }),
        gridClassName,
        className,
      )}
    >
      {Children.map(children, (child, index) => {
        if (child == null || typeof child === "boolean") return null;
        const key = isValidElement(child) && child.key != null ? child.key : index;
        return (
          <li key={key} className={cn("flex h-full min-w-0 flex-col", itemClassName)}>
            {child}
          </li>
        );
      })}
    </Tag>
  );
}
