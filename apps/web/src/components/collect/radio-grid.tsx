"use client";

import { cn } from "@auction/ui/lib/utils";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { ReactNode } from "react";

export type RadioGridItem = {
  id: string;
  /** Read out in full: "Thu 12 Nov, 7 times". */
  label: string;
  /** A choice that cannot be taken: shown, never chosen, skipped by the arrow keys. */
  disabled?: boolean;
  content: ReactNode;
  /** Classes for this choice, which may depend on whether it is chosen or cannot be taken. */
  className: (state: { checked: boolean; disabled: boolean }) => string;
};

/**
 * A group of choices where exactly one is chosen, on the radio-group pattern (one stop in the tab
 * order, arrow keys move and choose, a choice that cannot be taken is skipped), laid out as a
 * grid. `leadingBlanks` leaves empty cells before the first choice so a calendar's first day
 * falls under its weekday.
 */
export function RadioGrid({
  id,
  label,
  items,
  value,
  onValueChange,
  leadingBlanks = 0,
  className,
}: {
  id?: string;
  label: string;
  items: readonly RadioGridItem[];
  value: string | null;
  onValueChange: (id: string) => void;
  leadingBlanks?: number;
  className?: string;
}) {
  return (
    <RadioGroupPrimitive.Root
      {...(id ? { id, tabIndex: -1 } : {})}
      value={value ?? ""}
      aria-label={label}
      onValueChange={onValueChange}
      className={cn("outline-none", className)}
    >
      {Array.from({ length: leadingBlanks }, (_, blank) => (
        <span key={`blank-${String(blank)}`} aria-hidden />
      ))}
      {items.map((item) => (
        <RadioGroupPrimitive.Item
          key={item.id}
          value={item.id}
          aria-label={item.label}
          disabled={Boolean(item.disabled)}
          className={item.className({
            checked: item.id === value,
            disabled: Boolean(item.disabled),
          })}
        >
          {item.content}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
