import { ConnectionStatusChip } from "@/features/saleroom/components/shared/connection-status-chip";
import { SaleDeliveryModeBadge } from "@/features/saleroom/components/shared/sale-delivery-mode-badge";
import type { StaffSaleroomSessionVM } from "@/features/saleroom/types/staff-saleroom.vm";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import { formatMoney } from "@/lib/ui/format";
import type { Lot, SaleDeliveryMode } from "@auction/types";
import { LiveBadge } from "@auction/ui/components/live-badge";

type Props = {
  saleTitle: string;
  deliveryMode?: SaleDeliveryMode;
  session: StaffSaleroomSessionVM;
  currentLot: Lot | null;
  leaderLabel?: string | null;
  leaderAmount?: string | null;
};

export function ClerkSessionBar({
  saleTitle,
  deliveryMode,
  session,
  currentLot,
  leaderLabel,
  leaderAmount,
}: Props) {
  return (
    <div className="sticky top-0 z-10 space-y-3 rounded-lg border border-outline-variant/25 bg-surface-container-low/80 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        {deliveryMode ? <SaleDeliveryModeBadge mode={deliveryMode} /> : null}
        {session.isSessionLive ? <LiveBadge /> : null}
        <span className="font-body text-sm text-secondary capitalize">{session.status}</span>
      </div>
      <p className="font-body text-sm text-foreground">
        {saleTitle}
        {currentLot ? (
          <>
            {" "}
            · <span className="font-medium">{formatLotRunListLabel(currentLot)}</span>
          </>
        ) : null}
        {leaderLabel ? (
          <>
            {" "}
            · Leading: <span className="font-medium">{leaderLabel}</span>
            {leaderAmount ? (
              <span className="ml-1 tabular-nums text-secondary">
                at {formatMoney(leaderAmount)}
              </span>
            ) : null}
          </>
        ) : null}
      </p>
      <ConnectionStatusChip status={session.connectionStatus} lastEventAt={session.lastEventAt} />
    </div>
  );
}
