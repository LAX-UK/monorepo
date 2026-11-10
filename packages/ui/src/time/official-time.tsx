import { describeMoment } from "@auction/datetime";
import type { ReactNode } from "react";
import { cn } from "../lib/utils.js";
import { TimeChip } from "./time-chip.js";

export type OfficialTimeProps = {
  /** The moment, as an ISO instant. */
  instant: string;
  /** The zone the sale quotes its times in. */
  officialZone: string;
  /** Today's date, for the year in the official line; the moment itself when left out. */
  now?: Date;
  /**
   * The official line when the caller words more than the moment ("Closes Thu 12 Nov, 18:00 GMT",
   * "A late bid added 30 seconds · closes 18:42 GMT"). Without it, the moment alone is printed.
   */
  children?: ReactNode;
  className?: string;
};

/**
 * The sale's official time, as it has always been shown, with the visitor's own time in a chip
 * under it when their clock differs. The chip's row is held while the page learns the visitor's
 * zone (`html.tz-away`, set by the head script), so nothing moves when it arrives.
 */
export function OfficialTime({
  instant,
  officialZone,
  now = new Date(instant),
  children,
  className,
}: OfficialTimeProps) {
  const official = children ?? describeMoment(new Date(instant), { officialZone, now }).official;
  return (
    <>
      <time dateTime={instant} className={cn("tabular-nums", className)}>
        {official}
      </time>
      <TimeChipSlot instant={instant} officialZone={officialZone} />
    </>
  );
}

/**
 * Where the chip goes: an empty row that is 36px high only for a visitor on another clock, so a
 * first visit does not shift and a UK visitor gets no gap.
 */
export function TimeChipSlot({
  instant,
  officialZone,
}: Pick<OfficialTimeProps, "instant" | "officialZone">) {
  return (
    <span className="tz-chip-slot">
      <TimeChip instant={instant} officialZone={officialZone} />
    </span>
  );
}
