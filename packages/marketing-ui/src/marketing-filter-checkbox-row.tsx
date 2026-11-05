"use client";

import { cn } from "@auction/ui";
import { Checkbox } from "@auction/ui/components/checkbox";
import { Label } from "@auction/ui/components/label";

export type MarketingFilterCheckboxRowProps = {
  /** Unique on the page, so the label reaches its checkbox. */
  id: string;
  label: string;
  /** Works the option would give with the other filters; absent when counts are not offered. */
  count?: number | undefined;
  checked: boolean;
  /** Set for an option that cannot be chosen. A chosen option stays enabled so it can be taken off. */
  disabled?: boolean | undefined;
  onCheckedChange: (checked: boolean) => void;
  /** A closer row on large screens, for a rail beside the results; phones keep the touch size. */
  dense?: boolean;
  className?: string;
};

/**
 * One option in a filter rail, sheet or dropdown: a real checkbox, its label and the count. The
 * count is part of the label for assistive technology ("Paintings, 12"). An option with no works
 * is dimmed and cannot be chosen, unless it is already chosen.
 */
export function MarketingFilterCheckboxRow({
  id,
  label,
  count,
  checked,
  disabled = false,
  onCheckedChange,
  dense = false,
  className,
}: MarketingFilterCheckboxRowProps) {
  const unavailable = !checked && (disabled || count === 0);
  return (
    <div className={cn("flex min-h-11 items-center gap-3", dense && "lg:min-h-9", className)}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={unavailable}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
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
