import type { SaleListSortKey } from "@/lib/admin/sales-list-sort";
import type { SaleStatus } from "@auction/types";

export type AdminSaleBoardRow = {
  saleId: string;
  title: string;
  status: SaleStatus;
  lotCount: number;
  startTimeIso: string;
  startTimeLabel: string;
  sparklineValues: number[];
  canDelete: boolean;
};

export type SaleColumnSortConfig = {
  current?: string | undefined;
  hrefs: Record<SaleListSortKey, string>;
};
