"use client";

import { cn } from "@auction/ui";
import { Label } from "@auction/ui/components/label";
import { RadioGroupItem } from "@auction/ui/components/radio-group";

export type MarketingFilterRadioRowProps = {
  /** Unique on the page, so the label reaches its radio. */
  id: string;
  value: string;
  label: string;
  /** Works the option would give with the other filters; absent when counts are not offered. */
  count?: number | undefined;
  /** Whether this is the chosen option; an empty option stays enabled while chosen. */
  checked: boolean;
  /** A closer row on large screens, for a rail beside the results; phones keep the touch size. */
  dense?: boolean;
  className?: string;
};

/**
 * One option of a choice that takes a single value, inside a `RadioGroup`: a real radio, its label
 * and the count, read together ("For sale, 18"). An option with no works is dimmed and cannot be
 * chosen, unless it is the chosen one.
 */
export function MarketingFilterRadioRow({
  id,
  value,
  label,
  count,
  checked,
  dense = false,
  className,
}: MarketingFilterRadioRowProps) {
  const unavailable = count === 0 && !checked;
  return (
    <div className={cn("flex min-h-11 items-center gap-3", dense && "lg:min-h-9", className)}>
      <RadioGroupItem id={id} value={value} disabled={unavailable} />
      <Label
        htmlFor={id}
        className={cn(
          "flex min-h-11 flex-1 items-center justify-between gap-2 py-2 font-body text-sm font-normal text-on-surface",
          dense && "lg:min-h-9",
          unavailable ? "cursor-not-allowed text-on-surface-variant opacity-60" : "cursor-pointer",
        )}
      >
        <span>{label}</span>
        {count !== undefined ? (
          <>
            <span
              aria-hidden="true"
              className="font-body text-xs tabular-nums text-on-surface-variant"
            >
              {count}
            </span>
            <span className="sr-only">, {count}</span>
          </>
        ) : null}
      </Label>
    </div>
  );
}
