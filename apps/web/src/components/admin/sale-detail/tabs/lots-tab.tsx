import { SaleLotsTabBoard } from "@/components/admin/sale-detail/sale-lots-tab-board";
import type { CategoryNode, Lot, Sale } from "@auction/types";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  canManageAuction?: boolean;
  categories?: CategoryNode[];
  englishOnlyAuctionsLocked?: boolean;
  artistNameById?: Record<string, string>;
};

export function SaleLotsTab({
  saleId,
  sale,
  lots,
  canManageAuction = false,
  categories = [],
  englishOnlyAuctionsLocked = false,
  artistNameById = {},
}: Props) {
  return (
    <SaleLotsTabBoard
      saleId={saleId}
      sale={{
        status: sale.status,
        deliveryMode: sale.deliveryMode,
        startTime: sale.startTime,
        endTime: sale.endTime,
      }}
      lots={lots}
      canManageAuction={canManageAuction}
      categories={categories}
      englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
      artistNameById={artistNameById}
    />
  );
}
