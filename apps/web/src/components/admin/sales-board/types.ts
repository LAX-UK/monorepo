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
  /** Linked to or selling on ATG (shared ownership rule); drives the compact ATG marker. */
  onAtg?: boolean;
};

export type SaleColumnSortConfig = {
  current?: string | undefined;
  hrefs: Record<SaleListSortKey, string>;
};
