import type { SaleListSortKey } from "@/lib/admin/sales-list-sort";
import type { SaleDeliveryMode, SaleStatus } from "@auction/types";

export type AdminSaleBoardRow = {
  saleId: string;
  title: string;
  status: SaleStatus;
  lotCount: number;
  coverImageUrl: string | null;
  deliveryMode: SaleDeliveryMode;
  typeLabel: string;
  startTimeIso: string;
  /** @deprecated Prefer startTimeIso with AdminTableDateTimeCell in tables */
  startTimeLabel: string;
  endTimeIso: string | null;
  /** @deprecated Prefer endTimeIso with AdminTableDateTimeCell in tables */
  endTimeLabel: string;
  sparklineValues: number[];
  canDelete: boolean;
};

export type SaleColumnSortConfig = {
  current?: string | undefined;
  hrefs: Record<SaleListSortKey, string>;
};
