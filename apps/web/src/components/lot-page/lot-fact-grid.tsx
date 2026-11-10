import type { LotInfoRow } from "@/lib/lot-page/lot-time-rows";
import { cn } from "@auction/ui";
import { LotCountdownFact } from "./lot-countdown-fact";
import { LotFact } from "./lot-fact";

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
