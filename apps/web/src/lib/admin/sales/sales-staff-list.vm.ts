import { buildListHref } from "@/lib/admin/admin-list-params";
import { adminSaleEditHref, adminSaleHref } from "@/lib/admin/catalog-route-helpers";
import type { AdminSaleBoardRow } from "@/lib/admin/catalog/sale-table-row";
import type { CatalogActiveFilterChip, CatalogSegmentItem } from "@/lib/admin/catalog/types";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminSalesListSummary } from "@/lib/data/http/admin-sales-summary.server";
import { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";
import { salePath } from "@/lib/seo/url";
import {
  type AttentionStripItem,
  type Metric,
  type DataView as StaffDataView,
  type StatusPresentation,
  formatStaffMoney,
} from "@auction/staff-ui";
import type { SaleStatus } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

export const SALES_LIST_PATH = "/admin/sales";

export type SalesListSearch = Record<string, string | string[] | undefined>;

/** One sale as the staff list shows it; plain data, so it crosses to the client as is. */
export type SalesStaffRow = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  statusCode: SaleStatus;
  status: StatusPresentation;
  /** "Online", "Onsite" or "Hybrid". */
  delivery: string;
  saleroom: boolean;
  lotCount: number;
  /** "Onsite · 12 lots". */
  context: string;
  startsAt: string;
  endsAt: string | null;
  addedAt: string;
  href: string;
  editHref: string | null;
  publicHref: string;
  canDelete: boolean;
};

const count = new Intl.NumberFormat("en-GB");

/** "1 lot", "12 lots", "No lots yet". */
export function lotCountLabel(lots: number): string {
  if (lots === 0) return "No lots yet";
  return `${count.format(lots)} ${lots === 1 ? "lot" : "lots"}`;
}

export function toSalesStaffRows(rows: readonly AdminSaleBoardRow[]): SalesStaffRow[] {
  return rows.map((row) => {
    const delivery = deliveryModeShortLabel(row.deliveryMode);
    return {
      id: row.saleId,
      title: row.title,
      coverImageUrl: row.coverImageUrl,
      statusCode: row.status,
      status: staffStatus("sale", row.status),
      delivery,
      saleroom: isSaleroomDeliveryMode(row.deliveryMode),
      lotCount: row.lotCount,
      context: `${delivery} · ${lotCountLabel(row.lotCount)}`,
      startsAt: row.startTimeIso,
      endsAt: row.endTimeIso,
      addedAt: row.createdAtIso,
      href: adminSaleHref(row.saleId),
      editHref:
        row.status === "draft" || row.status === "scheduled" ? adminSaleEditHref(row.saleId) : null,
      publicHref: salePath({ id: row.saleId, title: row.title }),
      canDelete: row.canDelete,
    };
  });
}

/** The list URL with `patch` applied; any change returns to the first page. */
export function salesListHref(
  current: SalesListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: SalesListSearch = { ...current };
  for (const key of ["error", "success", "period", "sale"]) delete base[key];
  return buildListHref(SALES_LIST_PATH, base, { offset: null, ...patch });
}

/** The list with a sale's panel open (`?sale=`), or closed for null; keeps the page. */
export function salePanelHref(current: SalesListSearch, saleId: string | null): string {
  const base: SalesListSearch = { ...current };
  for (const key of ["error", "success", "period"]) delete base[key];
  return buildListHref(SALES_LIST_PATH, base, { sale: saleId });
}

/** The lifecycle lenses as view tabs, each with its count. */
export function salesViews(lenses: readonly CatalogSegmentItem[]): StaffDataView[] {
  return lenses.map((lens) => ({
    id: lens.id,
    label: lens.label,
    href: lens.href,
    ...(lens.badge !== undefined ? { count: lens.badge } : {}),
  }));
}

export const SALE_DELIVERY_FILTERS = [
  { value: "online", label: "Online" },
  { value: "onsite", label: "Onsite" },
] as const;

/** Work waiting on the sales desk, each linking to the view that holds it. */
export function salesAttention(
  search: SalesListSearch,
  summary: AdminSalesListSummary,
): AttentionStripItem[] {
  const setup = summary.lensCounts.setup;
  return [
    {
      id: "setup",
      count: setup,
      label: setup === 1 ? "draft sale needs setting up" : "draft sales need setting up",
      href: salesListHref(search, { lens: "setup", lifecycle: null, status: "draft" }),
      actionLabel: "Finish setup",
      tone: "warning",
    },
  ];
}

/** Headline numbers across every sale, from the sales summary. */
export function salesMetrics(summary: AdminSalesListSummary): Metric[] {
  const hammer = Number.parseFloat(summary.totalHammerValue);
  return [
    { id: "live", label: "Live", value: count.format(summary.activeCount) },
    { id: "upcoming", label: "Upcoming", value: count.format(summary.upcomingCount) },
    { id: "draft", label: "Drafts", value: count.format(summary.draftCount) },
    {
      id: "hammer",
      label: "Hammer total",
      value: formatStaffMoney(Math.round((Number.isFinite(hammer) ? hammer : 0) * 100)),
    },
  ];
}

/**
 * The filters in force beyond the view tab, as chips. The search shows in its own field, the
 * sort in the column headers and the lifecycle in the tabs, so none of them repeats as a chip.
 */
export function salesFilterChips(chips: readonly CatalogActiveFilterChip[]) {
  return chips
    .filter((chip) => !["q", "sort", "lens", "lifecycle"].includes(chip.id))
    .map((chip) => ({ id: chip.id, label: chip.label, clearHref: chip.clearHref }));
}

/** The server's default order: newest sales first. */
export const SALES_DEFAULT_SORT = { columnId: "added", direction: "desc" as const };

/** Column sort to the server's keys: newest first (the default), or starting soonest. */
export function salesSortHref(
  current: SalesListSearch,
  sort: { columnId: string; direction: "asc" | "desc" },
): string {
  if (sort.columnId === "starts") return salesListHref(current, { sort: "startAsc" });
  return salesListHref(current, { sort: null });
}

export function salesSortState(sort: string | undefined) {
  return sort === "startAsc"
    ? { columnId: "starts", direction: "asc" as const }
    : SALES_DEFAULT_SORT;
}

/** "1–50 of 312 sales", or "1–50 sales" while the total is not known. */
export function salesRangeSummary(offset: number, shown: number, total: number | undefined) {
  const range = `${count.format(offset + 1)}–${count.format(offset + shown)}`;
  if (total === undefined) return `${range} sales`;
  return `${range} of ${count.format(total)} ${total === 1 ? "sale" : "sales"}`;
}
