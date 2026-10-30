import { staffAtgLotStatus } from "@/lib/admin/staff-kit-status";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import { StatusBadge } from "@auction/staff-ui";
import type { AtgLotSyncView } from "@auction/types";

/** Compact ATG link summary shown on the admin lot overview for lots pushed to ATG. */
export function AtgLotStatus({ lot }: { lot: AtgLotSyncView }) {
  const state = staffAtgLotStatus(lot);
  const price =
    lot.hammerPrice != null
      ? `Hammer ${formatMoney(lot.hammerPrice)}`
      : lot.currentMaxBid != null
        ? `Current bid ${formatMoney(lot.currentMaxBid)}`
        : null;

  return (
    <section
      className="mb-6 flex flex-col gap-2 rounded-staff-lg border border-staff-line bg-staff-surface px-4 py-3 text-staff-sm"
      aria-label="ATG White Label status"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-medium text-staff-muted">ATG</span>
        <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
        {price ? <span className="text-staff-fg">{price}</span> : null}
        <span className="text-staff-muted">Last pushed {formatDateTime(lot.lastSyncedAt)}</span>
      </div>
      {lot.lastError ? <p className="text-staff-danger">{lot.lastError}</p> : null}
    </section>
  );
}
