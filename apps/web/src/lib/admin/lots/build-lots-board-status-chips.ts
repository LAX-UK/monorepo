import type { FilterChip } from "@/components/admin/filter-chip-row";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { LotsListSearchParams } from "@/lib/admin/build-lots-list-page-model";
import { adminLotListPath } from "@/lib/admin/catalog-routes";

export type LotsBoardQuickStatus = "all" | "live" | "withdraw" | "sold";

export function lotsBoardQuickStatus(sp: LotsListSearchParams): LotsBoardQuickStatus {
  const status = String(sp.status ?? "");
  if (status === "active") return "live";
  if (status === "cancelled" || status === "voided") return "withdraw";
  if (status === "ended") return "sold";
  return "all";
}

/** Table-card quick filter chips — All / Live / Withdraw / Sold (Figma). */
export function buildLotsBoardStatusChips(
  sp: LotsListSearchParams,
  active: LotsBoardQuickStatus,
): FilterChip[] {
  const base = adminLotListPath();
  const clearStatus = { status: "", offset: 0 };

  return [
    {
      id: "all",
      label: "All",
      href: buildListHref(base, sp, clearStatus),
      active: active === "all",
    },
    {
      id: "live",
      label: "Live",
      href: buildListHref(base, sp, { ...clearStatus, status: "active" }),
      active: active === "live",
    },
    {
      id: "withdraw",
      label: "Withdraw",
      href: buildListHref(base, sp, { ...clearStatus, status: "cancelled" }),
      active: active === "withdraw",
    },
    {
      id: "sold",
      label: "Sold",
      href: buildListHref(base, sp, { ...clearStatus, status: "ended" }),
      active: active === "sold",
    },
  ];
}
