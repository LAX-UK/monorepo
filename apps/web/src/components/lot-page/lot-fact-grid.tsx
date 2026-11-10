import type { LotInfoRow } from "@/lib/lot-page/lot-time-rows";
import { cn } from "@auction/ui";
import { LotCountdownFact } from "./lot-countdown-fact";
import { LotFact } from "./lot-fact";

/**
 * A row keeps its place as its words change ("Time left" to "Final minutes" to "Extended"), so its
 * countdown is one component through the whole close and can mark a late bid the first time.
 */
function rowKey(row: LotInfoRow): string {
  return row.clock ? "time" : row.label;
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
          <LotCountdownFact key={rowKey(row)} row={row} countdown={row.countdown} />
        ) : (
          <LotFact key={rowKey(row)} {...row} />
        ),
      )}
    </dl>
  );
}
