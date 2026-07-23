import { DetailBoardKpiStrip, DetailBoardShell } from "@/components/admin/catalog/detail-board";
import { OperationsLivePanel } from "@/features/saleroom/components/operations-live-panel/operations-live-panel";
import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin.server";
import { buildSaleOperationsKpiTiles } from "@/lib/data/view-models/sale-operations-tab.vm";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import type { Lot, Sale } from "@auction/types";

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  snapshot: AdminSaleOperationsSnapshot | null;
  paddleRoster?: AdminPaddleRosterEntry[];
  lots?: Lot[];
};

export function SaleroomOperationsCommandCenter({
  saleId,
  sale,
  liveish,
  snapshot,
  paddleRoster = [],
  lots = [],
}: Props) {
  const kpiTiles =
    snapshot != null ? buildSaleOperationsKpiTiles(snapshot, paddleRoster.length) : [];

  return (
    <div className="space-y-6">
      {kpiTiles.length > 0 ? (
        <DetailBoardKpiStrip ariaLabel="Operations summary" tiles={kpiTiles} />
      ) : null}
      <DetailBoardShell
        title="Saleroom operations"
        description="Live session status, pending registrations, and telephone line workload."
      >
        {snapshot ? (
          <OperationsLivePanel
            saleId={saleId}
            sale={sale}
            liveish={liveish}
            snapshot={snapshot}
            paddleRoster={paddleRoster}
            lots={lots}
          />
        ) : (
          <p className="font-body text-sm text-on-surface-variant">
            Could not load the live operations snapshot for this sale.
          </p>
        )}
      </DetailBoardShell>
    </div>
  );
}

/** @deprecated Use SaleroomOperationsCommandCenter */
export const OnsiteOperationsCommandCenter = SaleroomOperationsCommandCenter;
