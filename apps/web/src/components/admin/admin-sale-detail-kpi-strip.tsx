import { CatalogDetailSummaryStrip } from "@/components/admin/catalog";
import { buildSaleSummaryItems } from "@/lib/admin/build-sale-summary-items";
import type { Sale } from "@auction/types";

type Props = {
  saleId: string;
  sale: Sale;
  lotCount: number;
  aggregateHammer: string;
  liveish: boolean;
  registrationCount: number | null;
};

/** Overview-only metric strip for sale detail. */
export function AdminSaleDetailKpiStrip({
  saleId,
  sale,
  lotCount,
  aggregateHammer,
  liveish,
  registrationCount,
}: Props) {
  return (
    <CatalogDetailSummaryStrip
      items={buildSaleSummaryItems(
        saleId,
        sale,
        lotCount,
        aggregateHammer,
        liveish,
        registrationCount,
      )}
    />
  );
}
