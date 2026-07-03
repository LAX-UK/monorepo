import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { IAdminListController } from "@/lib/admin/i-admin-list-controller";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { getAdminSalesList } from "@/lib/data/http/admin.server";
import type { SaleDeliveryMode, SaleStatus } from "@auction/types";
import type { SaleLifecycleSlug, SalesListQuery } from "./sales-list-query";

export type { SaleLifecycleSlug, SalesListQuery } from "./sales-list-query";

const saleStatuses: SaleStatus[] = ["draft", "scheduled", "active", "ended", "cancelled"];

const saleLifecycleStatuses: Partial<Record<SaleLifecycleSlug, SaleStatus>> = {
  upcoming: "scheduled",
  live: "active",
  closed: "ended",
  settled: "ended",
};

export const salesListController: IAdminListController<AdminSaleListRow, SalesListQuery> = {
  id: "sales",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const lifeRaw = firstString(sp.lifecycle)?.trim()?.toLowerCase();
    const life =
      lifeRaw && ["upcoming", "live", "closed", "settled"].includes(lifeRaw as SaleLifecycleSlug)
        ? (lifeRaw as SaleLifecycleSlug)
        : undefined;
    const lifecycleStatus = life ? saleLifecycleStatuses[life] : undefined;
    const st = firstString(sp.status);
    const explicitStatus =
      lifecycleStatus !== undefined
        ? undefined
        : st && st !== "all" && (saleStatuses as readonly string[]).includes(st)
          ? (st as SaleStatus)
          : undefined;
    const status = lifecycleStatus ?? explicitStatus;
    const deliveryRaw = firstString(sp.delivery)?.trim()?.toLowerCase();
    const delivery =
      deliveryRaw === "online" || deliveryRaw === "onsite"
        ? (deliveryRaw as "online" | "onsite")
        : undefined;
    const lensRaw = firstString(sp.lens)?.trim()?.toLowerCase();
    const needsSetup = lensRaw === "setup" || firstString(sp.needsSetup) === "1";
    return {
      ...base,
      lifecycle: life,
      status: needsSetup ? "draft" : status,
      delivery,
      needsSetup: needsSetup || undefined,
      limit: Math.min(100, base.limit),
    };
  },
  async fetch(q) {
    const life = q.lifecycle;
    const settlementStatus =
      life === "closed"
        ? ("unsettled" as const)
        : life === "settled"
          ? ("settled" as const)
          : undefined;

    const p: {
      limit: number;
      offset: number;
      status?: SaleStatus;
      q?: string;
      deliveryMode?: SaleDeliveryMode;
      settlementStatus?: "settled" | "unsettled";
      sort?: "createdDesc" | "startAsc";
      needsSetup?: boolean;
    } = {
      limit: q.limit,
      offset: q.offset,
    };
    if (q.status !== undefined) p.status = q.status;
    else if (settlementStatus) p.status = "ended";
    if (q.q !== undefined && q.q !== "") p.q = q.q;
    if (q.delivery) p.deliveryMode = q.delivery;
    if (settlementStatus) p.settlementStatus = settlementStatus;
    if (q.sort) p.sort = q.sort as "createdDesc" | "startAsc";
    if (q.needsSetup) p.needsSetup = true;
    const fetchLimit = q.limit + 1;
    const rows = await getAdminSalesList({ ...p, limit: fetchLimit });
    const hasNextPage = rows.length > q.limit;
    const pageRows = hasNextPage ? rows.slice(0, q.limit) : rows;
    return { rows: pageRows, offset: q.offset, limit: q.limit, hasNextPage };
  },
};

export type { SalesListExportFilters } from "../sales-list-export-filters";
export { salesListExportFilters } from "../sales-list-export-filters";
