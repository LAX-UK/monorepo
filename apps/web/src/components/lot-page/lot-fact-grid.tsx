import type { LotInfoRow, LotInfoTone } from "@/lib/lot-page/lot-time-rows";
import { cn } from "@auction/ui";
import { Clock } from "lucide-react";

/** The clock tightens from calm to soon to final; words change with the colour. */
const TONE_CLASS: Readonly<Record<LotInfoTone, string>> = {
  calm: "",
  ended: "",
  soon: "text-lax-warning-fg",
  final: "text-lax-danger",
};

/**
 * The facts beside the headline figure, as a description list: the estimate and the time. One
 * fact fills the row; two share it. Times tick without being announced, so a screen reader is
 * not read the clock.
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
      {rows.map((row) => (
        <div key={row.label} className={cn("min-w-0", TONE_CLASS[row.tone])}>
          <dt
            className={cn(
              "flex items-center gap-1.5 text-lax-13 leading-5",
              row.tone === "soon" || row.tone === "final" ? "" : "text-lax-muted",
            )}
          >
            {row.clock ? <Clock aria-hidden className="size-3.5 shrink-0" /> : null}
            {row.label}
          </dt>
          <dd className="m-0 mt-0.5 text-lax-16 leading-6 font-medium tabular-nums">{row.value}</dd>
          {row.sub ? <dd className="m-0 text-lax-13 leading-5 text-lax-muted">{row.sub}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
