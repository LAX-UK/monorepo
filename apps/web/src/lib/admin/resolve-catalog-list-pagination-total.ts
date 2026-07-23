import type { LotLensId } from "@/lib/admin/catalog/lots-lenses";
import type { SaleLensId } from "@/lib/admin/catalog/sales-lenses";
import type { AdminLotsLensCounts } from "@/lib/data/http/admin-lots-summary.server";
import type { AdminSalesLensCounts } from "@/lib/data/http/admin-sales-summary.server";

/** When list filters match a lens only, expose lens totals for pagination range labels. */
export function resolveLotsListPaginationTotal(input: {
  activeLens: LotLensId;
  lensCounts: AdminLotsLensCounts;
  hasFiltersBeyondLens: boolean;
}): number | undefined {
  if (input.hasFiltersBeyondLens) return undefined;
  return input.lensCounts[input.activeLens];
}

export function resolveSalesListPaginationTotal(input: {
  activeLensId: SaleLensId;
  lensCounts: AdminSalesLensCounts;
  hasFiltersBeyondLens: boolean;
}): number | undefined {
  if (input.hasFiltersBeyondLens) return undefined;
  return input.lensCounts[input.activeLensId];
}
