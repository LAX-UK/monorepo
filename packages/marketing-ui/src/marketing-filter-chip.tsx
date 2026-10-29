import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type MarketingFilterChipProps = {
  label: ReactNode;
  /** Works the chip would give, shown after the label and read as "3 works". */
  count?: number;
  /** Noun for the spoken count, singular and plural. */
  countNoun?: { one: string; other: string };
  /** Applied: the chip takes the product accent and reports `aria-pressed`. */
  active?: boolean;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "children" | "type">;

const DEFAULT_NOUN = { one: "work", other: "works" };

/**
 * A one-tap filter in a `MarketingChipStrip`: the label, then its count in the secondary text
 * colour. The edge is the field edge, 3:1 on every surface; an applied chip takes the product
 * accent's edge on a light tint of it, and the label stays in the text colour.
 */
export function MarketingFilterChip({
  label,
  count,
  countNoun = DEFAULT_NOUN,
  active = false,
  className,
  ...props
}: MarketingFilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "marketing-filter-chip relative inline-flex min-h-11 shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full border px-4 font-body text-sm font-medium text-on-surface transition-colors motion-reduce:transition-none disabled:cursor-not-allowed lg:min-h-10",
        active
          ? "border-[color:var(--color-product-accent,currentColor)] bg-[color:color-mix(in_srgb,var(--color-product-accent,currentColor)_8%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--color-product-accent,currentColor)_14%,transparent)]"
          : "border-input-border bg-transparent hover:border-on-surface-variant hover:bg-surface-container-low",
        FOCUS_RING,
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      {count !== undefined ? (
        <span className="tabular-nums text-on-surface-variant">
          <span aria-hidden="true">{count}</span>
          <span className="sr-only">
            , {count} {count === 1 ? countNoun.one : countNoun.other}
          </span>
        </span>
      ) : null}
    </button>
  );
}
