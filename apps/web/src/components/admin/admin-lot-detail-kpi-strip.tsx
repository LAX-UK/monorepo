import { CatalogDetailSummaryStrip } from "@/components/admin/catalog";
import { buildLotSummaryItems } from "@/lib/admin/build-lot-summary-items";
import type { Lot } from "@auction/types";

type Props = {
  lotId: string;
  auction: Lot;
  bidCount: number | null;
};

/** Overview-only metric strip for lot detail. */
export function AdminLotDetailKpiStrip({ lotId, auction, bidCount }: Props) {
  return <CatalogDetailSummaryStrip items={buildLotSummaryItems(lotId, auction, bidCount)} />;
}
