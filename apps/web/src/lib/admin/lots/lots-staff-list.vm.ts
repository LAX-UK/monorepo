import { buildListHref } from "@/lib/admin/admin-list-params";
import { adminLotEditHref, adminLotHref } from "@/lib/admin/catalog-route-helpers";
import { adminLotListPath } from "@/lib/admin/catalog-routes";
import type { AdminLotTableRow } from "@/lib/admin/catalog/lot-table-row";
import { toStaffStatus } from "@/lib/admin/staff-kit-status";
import { lotAuctionTypeLabel } from "@/lib/presenters/lot-auction-type/lot-auction-type-registry";
import { lotStatusLabel, lotStatusToBadgeVariant } from "@/lib/presenters/status-presentation";
import { type StatusPresentation, type TeamView, viewQuery } from "@auction/staff-ui";

export type LotsListSearch = Record<string, string | string[] | undefined>;

/** One lot as the staff list shows it; plain data, so it crosses to the client as is. */
export type LotsStaffRow = {
  id: string;
  title: string;
  lotNumber: number | null;
  thumbnailUrl: string | null;
  artist: string | null;
  saleTitle: string | null;
  saleHref: string | null;
  status: StatusPresentation;
  auctionType: string;
  estimate: string;
  hammer: string;
  endsAt: string;
  href: string;
  editHref: string;
  photos: number;
};

export function toLotsStaffRows(rows: readonly AdminLotTableRow[]): LotsStaffRow[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    lotNumber: row.lotNumber,
    thumbnailUrl: row.thumbnailUrl,
    artist: row.artistLabel,
    saleTitle: row.saleTitle,
    saleHref: row.saleId ? `/admin/sales/${row.saleId}` : null,
    status: toStaffStatus(
      lotStatusToBadgeVariant(row.status),
      lotStatusLabel[row.status] ?? row.status,
    ),
    auctionType: lotAuctionTypeLabel(row.auctionType),
    estimate: row.estimateDisplay.primary,
    hammer: row.hammerDisplay.primary,
    endsAt: row.endTimeIso,
    href: adminLotHref(row.id),
    editHref: adminLotEditHref(row.id),
    photos: row.imageCount,
  }));
}

/** Status quick filter, as the lots API understands it. */
export const LOT_STATUS_FILTERS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Live" },
  { value: "ended", label: "Ended" },
  { value: "cancelled", label: "Withdrawn" },
] as const;

/** The list URL with `patch` applied; any filter change returns to the first page. */
export function lotsListHref(
  current: LotsListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  return buildListHref(adminLotListPath(), current, { offset: 0, ...patch });
}

/**
 * Views of the lots list everyone sees, beyond the lens tabs: combinations of the list's own
 * filters. Fixed here, never edited.
 */
export function lotsTeamViews(): TeamView[] {
  const view = (id: string, label: string, patch: Record<string, string>) => {
    const [path, rest = ""] = lotsListHref({}, patch).split("?");
    const query = viewQuery(rest);
    return { id: `team-${id}`, label, href: `${path}?${query}`, query };
  };
  return [
    view("drafts-missing-photos", "Drafts missing photos", { status: "draft", needsPhotos: "1" }),
    view("live-ending-first", "Live, ending soonest", { status: "active", sort: "endingAsc" }),
    view("ended-by-hammer", "Ended, highest hammer first", {
      status: "ended",
      sort: "hammerDesc",
    }),
  ];
}

/**
 * Column sort to the server's sort keys. The lots API sorts by created, ending, hammer and
 * ended time; columns map onto those, and a third click clears back to the default order.
 */
export function lotsSortHref(
  current: LotsListSearch,
  sort: { columnId: string; direction: "asc" | "desc" } | null,
): string {
  if (!sort) return lotsListHref(current, { sort: null });
  if (sort.columnId === "ends") {
    return lotsListHref(current, { sort: sort.direction === "asc" ? "endingAsc" : "endedDesc" });
  }
  if (sort.columnId === "hammer") return lotsListHref(current, { sort: "hammerDesc" });
  return lotsListHref(current, { sort: null });
}

export function lotsSortState(sort: string | undefined) {
  switch (sort) {
    case "endingAsc":
      return { columnId: "ends", direction: "asc" as const };
    case "endedDesc":
      return { columnId: "ends", direction: "desc" as const };
    case "hammerDesc":
      return { columnId: "hammer", direction: "desc" as const };
    default:
      return null;
  }
}
