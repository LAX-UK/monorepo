import type { AdminTableMoneyDisplay } from "@/lib/admin/format-admin-table-money";
import type { LotAuctionType, LotStatus, SaleDeliveryMode, SaleStatus } from "@auction/types";

export type AdminLotTableRow = {
  id: string;
  title: string;
  lotNumber: number | null;
  thumbnailUrl: string | null;
  estimateDisplay: AdminTableMoneyDisplay;
  imageCount: number;
  artistLabel: string | null;
  saleId: string | null;
  saleTitle: string | null;
  saleStatus: SaleStatus | null;
  saleDeliveryMode: SaleDeliveryMode | null;
  auctionType: LotAuctionType;
  status: LotStatus;
  endTimeIso: string;
  /** @deprecated Prefer endTimeIso with AdminTableDateTimeCell in tables; kept for mobile cards */
  endTimeLabel: string;
  hammerDisplay: AdminTableMoneyDisplay;
  canDelete: boolean;
};

export type LotColumnSortConfig = {
  current?: string | undefined;
  hrefs: Pick<
    Record<import("@/lib/admin/lots-list-sort").LotListSortKey, string>,
    "createdDesc" | "endingAsc" | "hammerDesc" | "endedDesc"
  >;
};
