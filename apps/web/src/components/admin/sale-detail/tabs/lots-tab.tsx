import { SaleLotsTabSection } from "@/components/admin/sale-lots-tab-section";
import type { Lot, Sale } from "@auction/types";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  draftOrphans: Lot[];
};

export function SaleLotsTab({ saleId, sale, lots, draftOrphans }: Props) {
  const canEdit = sale.status === "draft";

  return (
    <SaleLotsTabSection
      saleId={saleId}
      saleStatus={sale.status}
      deliveryMode={sale.deliveryMode}
      canEdit={canEdit}
      lots={lots.map((l) => ({
        id: l.id,
        title: l.title,
        lotNumber: l.lotNumber,
        status: l.status,
      }))}
      draftOrphans={draftOrphans.map((l) => ({ id: l.id, title: l.title }))}
    />
  );
}
