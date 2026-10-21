import { cn } from "@auction/ui";
import { Children, type ReactNode } from "react";

export type MarketingFeatureGridVariant = "lead-plus-row" | "lead-plus-stack";

export type MarketingFeatureGridProps = {
  /**
   * `lead-plus-row`: lead across the top, the rest in a row of three (Figma home "What's on", `285:3008`).
   * `lead-plus-stack`: lead on the left, the two secondary items stacked on the right (Figma home stories, `285:3061`).
   */
  variant: MarketingFeatureGridVariant;
  lead: ReactNode;
  /** The secondary items; each child becomes one list item. */
  children?: ReactNode;
  "aria-label"?: string;
  className?: string;
};

/** Layout only: one emphasised item plus secondary items, all in one list for assistive tech. */
export function MarketingFeatureGrid({
  variant,
  lead,
  children,
  "aria-label": ariaLabel,
  className,
}: MarketingFeatureGridProps) {
  const isRow = variant === "lead-plus-row";

  return (
    <ul
      aria-label={ariaLabel}
      data-variant={variant}
      className={cn(
        "grid gap-x-6 gap-y-10",
        isRow ? "sm:grid-cols-2 lg:grid-cols-3" : "lg:grid-cols-2",
        className,
      )}
    >
      <li className={cn(isRow ? "sm:col-span-2 lg:col-span-3" : "lg:row-span-2")}>{lead}</li>
      {Children.toArray(children).map((item) => (
        // Children.toArray assigns each child a stable key; the wrapper reuses it.
        <li key={(item as { key: string }).key}>{item}</li>
      ))}
    </ul>
  );
}
