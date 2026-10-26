import type { LotStatus } from "@auction/types";

export type AdminLotTableRow = {
  id: string;
  title: string;
  auctionType: string;
  status: LotStatus;
  endTimeIso: string;
  endTimeLabel: string;
  currentPrice: string;
  canDelete: boolean;
  lastActivityType?: string;
  lastActivityAt?: string;
  lastActivityLabel?: string;
  /** Pushed to ATG in a sale that is not selling on lax.bid; drives the compact ATG marker. */
  onAtg?: boolean;
};

export type LotColumnSortConfig = {
  current?: string | undefined;
  hrefs: Pick<
    Record<import("@/lib/admin/lots-list-sort").LotListSortKey, string>,
    "createdDesc" | "endingAsc" | "hammerDesc" | "endedDesc"
  >;
};
