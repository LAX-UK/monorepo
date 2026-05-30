import type { LotStatus } from "@auction/types";

export type AdminLotTableRow = {
  id: string;
  title: string;
  auctionType: string;
  status: LotStatus;
  endTimeIso: string;
  endTimeLabel: string;
  currentPrice: string;
  lastActivityType?: string;
  lastActivityAt?: string;
  lastActivityLabel?: string;
};

export type LotColumnSortConfig = {
  current?: string | undefined;
  hrefs: Pick<
    Record<import("@/lib/admin/lots-list-sort").LotListSortKey, string>,
    "createdDesc" | "endingAsc" | "hammerDesc" | "endedDesc"
  >;
};
