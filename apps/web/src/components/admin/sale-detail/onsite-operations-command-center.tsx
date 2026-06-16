import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import { OperationsLivePanel } from "@/features/saleroom/components/operations-live-panel/operations-live-panel";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import type { Lot, Sale } from "@auction/types";

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  snapshot: AdminSaleOperationsSnapshot | null;
  checkedInPaddleCount?: number;
  lots?: Lot[];
};

export function SaleroomOperationsCommandCenter({
  saleId,
  sale,
  liveish,
  snapshot,
  checkedInPaddleCount = 0,
  lots = [],
}: Props) {
  return (
    <CatalogDetailTabPanel
      title="Saleroom operations"
      description="Live session status, pending registrations, and telephone line workload."
      framed={false}
    >
      {snapshot ? (
        <OperationsLivePanel
          saleId={saleId}
          sale={sale}
          liveish={liveish}
          snapshot={snapshot}
          checkedInPaddleCount={checkedInPaddleCount}
          lots={lots}
        />
      ) : (
        <p className="font-body text-sm text-on-surface-variant">
          Could not load the live operations snapshot for this sale.
        </p>
      )}
    </CatalogDetailTabPanel>
  );
}

/** @deprecated Use SaleroomOperationsCommandCenter */
export const OnsiteOperationsCommandCenter = SaleroomOperationsCommandCenter;
