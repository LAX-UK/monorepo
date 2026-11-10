import type { LotInfoTone, LotRowMoment } from "@/lib/lot-page/lot-time-rows";
import { cn } from "@auction/ui";
import { OfficialTime } from "@auction/ui/time";
import { Clock } from "lucide-react";

/** The clock tightens from calm to soon to final; words change with the colour. */
const TONE_CLASS: Readonly<Record<LotInfoTone, string>> = {
  calm: "",
  ended: "",
  soon: "text-lax-warning-fg",
  final: "text-lax-danger",
};

export type LotFactProps = {
  label: string;
  value: string;
  sub: string | null;
  tone: LotInfoTone;
  /** The row is a clock, so it carries the clock icon. */
  clock: boolean;
  /**
   * The time in words to the minute, for screen readers, when the printed value ticks: the
   * ticking text is hidden from them so they are not read the clock, and they get one sentence.
   */
  spoken?: string | undefined;
  /** Tints the value once to mark a late bid. */
  tinted?: boolean | undefined;
  /** The instant the second line quotes, so the visitor's own time can sit under it. */
  moment?: LotRowMoment | undefined;
};

/** One fact: a label, its value and an optional second line. */
export function LotFact({ label, value, sub, tone, clock, spoken, tinted, moment }: LotFactProps) {
  return (
    <div
      className={cn(
        "min-w-0",
        TONE_CLASS[tone],
        // The chip needs a line of its own on a phone: a visitor on another clock gets the
        // whole row, so "Fri 13 Nov, 05:00 in Sydney" does not wrap in a half-width column.
        moment && "max-sm:[.tz-away_&]:col-span-full",
      )}
    >
      <dt
        className={cn(
          "flex items-center gap-1.5 text-lax-13 leading-5",
          tone === "soon" || tone === "final" ? "" : "text-lax-muted",
        )}
      >
        {clock ? <Clock aria-hidden className="size-3.5 shrink-0" /> : null}
        {label}
      </dt>
      <dd
        className={cn(
          "m-0 mt-0.5 rounded-lax-badge text-lax-16 leading-6 font-medium tabular-nums transition-colors duration-[1200ms]",
          tinted ? "bg-lax-danger-bg" : "bg-transparent",
        )}
      >
        {spoken ? (
          <>
            <span aria-hidden>{value}</span>
            <span className="sr-only">{spoken}</span>
          </>
        ) : (
          value
        )}
      </dd>
      {sub ? (
        <dd className="m-0 text-lax-13 leading-5 text-lax-muted">
          {moment ? (
            <OfficialTime instant={moment.iso} officialZone={moment.zone}>
              {sub}
            </OfficialTime>
          ) : (
            sub
          )}
        </dd>
      ) : null}
    </div>
  );
}
