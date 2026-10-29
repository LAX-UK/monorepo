import {
  ConsolePanel,
  PanelHeading,
} from "@/features/saleroom/components/clerk-console/console-panel";
import { SaleroomActivityLog } from "@/features/saleroom/components/clerk-console/saleroom-activity-log";
import { formatSaleroomMoney } from "@/features/saleroom/lib/format-saleroom-money";
import type { SaleroomActivityEntry } from "@/features/saleroom/types/staff-saleroom.vm";
import type { ClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import { lotChargeCurrency } from "@/lib/money/currency";
import { formatLotRunListLabel } from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot } from "@auction/types";

type Props = {
  currentLot: Lot | null;
  liveBid: ClerkLotLiveBidState;
  activityLog: SaleroomActivityEntry[];
};

/**
 * What a screen too narrow for the controls shows: the lot on the block with its price and
 * leading bidder, then the room's activity. It updates as the room does, but takes no actions.
 */
export function ClerkReadOnlyView({ currentLot, liveBid, activityLog }: Props) {
  const currency = currentLot ? lotChargeCurrency(currentLot) : undefined;
  return (
    <div className="flex flex-col gap-4">
      <ConsolePanel className="flex flex-col gap-1">
        <PanelHeading>Lot on block</PanelHeading>
        {currentLot ? (
          <>
            <p className="text-staff-sm font-medium text-staff-fg">
              {formatLotRunListLabel(currentLot)}
            </p>
            <p className="font-staff-display text-staff-xl font-semibold text-staff-fg tabular-nums">
              {formatSaleroomMoney(liveBid.currentPrice, currency)}
            </p>
            <p className="text-staff-sm text-staff-muted tabular-nums">
              {liveBid.bidCount != null
                ? `${liveBid.bidCount} ${liveBid.bidCount === 1 ? "bid" : "bids"}`
                : "No bids yet"}
              {liveBid.leaderLabel ? ` · Leading: ${liveBid.leaderLabel}` : ""}
            </p>
          </>
        ) : (
          <p className="text-staff-sm text-staff-muted">No lot is on the block.</p>
        )}
      </ConsolePanel>
      <SaleroomActivityLog entries={activityLog} />
    </div>
  );
}
