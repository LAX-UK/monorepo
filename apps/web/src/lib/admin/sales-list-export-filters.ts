import type { SaleDeliveryMode, SaleStatus } from "@auction/types";
import type { SalesListQuery } from "./list-controllers/sales-list-query";

export type SalesListExportFilters = {
  status?: SaleStatus;
  q?: string;
  deliveryMode?: SaleDeliveryMode;
  settlementStatus?: "settled" | "unsettled";
  sort?: "createdDesc" | "startAsc";
};

/** Export filters mirroring `salesListController.fetch` (export schema has no `lifecycle`). */
export function salesListExportFilters(
  query: SalesListQuery,
  sort?: "createdDesc" | "startAsc",
): SalesListExportFilters {
  const life = query.lifecycle;
  const settlementStatus =
    life === "closed"
      ? ("unsettled" as const)
      : life === "settled"
        ? ("settled" as const)
        : undefined;

  const filters: SalesListExportFilters = {};
  if (query.status !== undefined) {
    filters.status = query.status;
  } else if (settlementStatus) {
    filters.status = "ended";
  }
  if (query.q !== undefined && query.q !== "") filters.q = query.q;
  if (query.delivery) filters.deliveryMode = query.delivery;
  if (settlementStatus) filters.settlementStatus = settlementStatus;
  if (sort) filters.sort = sort;
  return filters;
}
