"use client";

import { cn } from "../lib/utils.js";
import { TimeChip } from "./time-chip.js";
import { useHydrated } from "./use-hydrated.js";

export type ChipPlacement = "below" | "inline";

export type TimeChipSlotProps = {
  /** The moment, as an ISO instant. */
  instant: string;
  /** The zone the sale quotes its times in. */
  officialZone: string;
  /**
   * `below` puts the chip on its own row under the time. `inline` puts it on the same line, after
   * the time, when the parent is a wrapping flex row (the sale hero's meta line).
   */
  placement?: ChipPlacement;
};

/**
 * Where the chip goes: an empty row that holds room only for a visitor on another clock until
 * this row has hydrated, so a first visit does not shift and a UK visitor gets no gap. The row
 * says when it has settled (`data-settled`), in the commit that also fills the chip, so a visitor
 * from the sale's own zone (a Paris visitor on a Paris sale) is released at once. It is a div:
 * the open panel is a dialog holding paragraphs, which a span cannot contain.
 */
export function TimeChipSlot({ instant, officialZone, placement = "below" }: TimeChipSlotProps) {
  const settled = useHydrated();
  return (
    <div
      className={cn("tz-chip-slot", placement === "inline" && "tz-chip-slot--inline")}
      {...(settled ? { "data-settled": "" } : {})}
    >
      <TimeChip instant={instant} officialZone={officialZone} />
    </div>
  );
}
