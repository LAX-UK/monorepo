import type { LotInfoRow, LotInfoTone } from "@/lib/lot-page/lot-time-rows";
import { cn } from "@auction/ui";
import { Clock } from "lucide-react";
import { LotCountdownFact } from "./lot-countdown-fact";

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
};

/** One fact: a label, its value and an optional second line. */
export function LotFact({ label, value, sub, tone, clock, spoken, tinted }: LotFactProps) {
  return (
    <div className={cn("min-w-0", TONE_CLASS[tone])}>
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
      {sub ? <dd className="m-0 text-lax-13 leading-5 text-lax-muted">{sub}</dd> : null}
    </div>
  );
}

/**
 * The facts beside the headline figure, as a description list: the estimate and the time. One
 * fact fills the row; two share it. A time that counts is its own small component, so only it
 * redraws as the seconds change, and a screen reader is told the time to the minute, not the clock.
 */
export function LotFactGrid({ rows }: { rows: readonly LotInfoRow[] }) {
  if (rows.length === 0) return null;
  return (
    <dl
      className={cn(
        "m-0 mt-4 grid gap-4 border-t border-lax-line-subtle pt-4",
        rows.length > 1 ? "grid-cols-2" : "grid-cols-1",
      )}
    >
      {rows.map((row) =>
        row.countdown ? (
          <LotCountdownFact key={row.label} row={row} countdown={row.countdown} />
        ) : (
          <LotFact key={row.label} {...row} />
        ),
      )}
    </dl>
  );
}
