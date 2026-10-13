import { formatDateTime, formatMoney } from "@/lib/ui/format";
import type { AtgLotSyncView } from "@auction/types";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { atgLotState } from "./atg-lot-state";

/** Compact ATG link summary shown on the admin lot overview for lots pushed to ATG. */
export function AtgLotStatus({ lot }: { lot: AtgLotSyncView }) {
  const state = atgLotState(lot);
  const price =
    lot.hammerPrice != null
      ? `Hammer ${formatMoney(lot.hammerPrice)}`
      : lot.currentMaxBid != null
        ? `Current bid ${formatMoney(lot.currentMaxBid)}`
        : null;

  return (
    <section
      className="mb-6 space-y-2 rounded-lg border border-border-hairline px-4 py-3 text-sm"
      aria-label="ATG White Label status"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-label text-xs uppercase tracking-wide text-on-surface-variant">
          ATG
        </span>
        <StatusBadge variant={state.variant}>{state.label}</StatusBadge>
        {price ? <span className="text-on-surface">{price}</span> : null}
        <span className="text-on-surface-variant">
          Last pushed {formatDateTime(lot.lastSyncedAt)}
        </span>
      </div>
      {lot.lastError ? <p className="text-error">{lot.lastError}</p> : null}
    </section>
  );
}
