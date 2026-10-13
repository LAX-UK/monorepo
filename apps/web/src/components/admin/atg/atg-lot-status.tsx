import { formatDateTime, formatMoney } from "@/lib/ui/format";
import type { AtgLotSyncView } from "@auction/types";
import { StatusBadge } from "@auction/ui/components/status-badge";

/** Compact ATG link summary shown on the admin lot overview for lots pushed to ATG. */
export function AtgLotStatus({ lot }: { lot: AtgLotSyncView }) {
  const price =
    lot.hammerPrice != null
      ? `Hammer ${formatMoney(lot.hammerPrice)}`
      : lot.currentMaxBid != null
        ? `Current bid ${formatMoney(lot.currentMaxBid)}`
        : null;

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border-hairline px-4 py-3 text-sm"
      aria-label="ATG White Label status"
    >
      {lot.lastError ? (
        <StatusBadge variant="danger" title={lot.lastError}>
          ATG sync error
        </StatusBadge>
      ) : (
        <StatusBadge variant={lot.sold ? "success" : "info"}>
          {lot.sold ? "Sold on ATG" : `On ATG${lot.remoteStatus ? ` · ${lot.remoteStatus}` : ""}`}
        </StatusBadge>
      )}
      {lot.numberOfBids != null ? (
        <span className="text-on-surface-variant">{lot.numberOfBids} bids</span>
      ) : null}
      {price ? <span className="text-on-surface">{price}</span> : null}
      <span className="text-on-surface-variant">
        Last pushed {formatDateTime(lot.lastSyncedAt)}
      </span>
    </div>
  );
}
