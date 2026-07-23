"use client";

import { AdminSortableColumnHeader } from "@/components/admin/admin-sortable-column-header";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { AdminTableMoneyCell } from "@/components/admin/admin-table-money-cell";
import { LotAuctionTypeChip } from "@/components/admin/lot-auction-type-chip";
import { LotSaleContextCell } from "@/components/admin/lots-board/lot-sale-context-cell";
import { LotStatusCell } from "@/components/admin/lots-board/lot-status-cell";
import { LotBoardMobileActionMenu } from "@/components/admin/lots-board/mobile-action-menu";
import type { AdminLotTableRow, LotColumnSortConfig } from "@/components/admin/lots-board/types";
import { MediaImage } from "@/components/ui/media-image";
import { adminLotHref } from "@/lib/admin/catalog-route-helpers";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";
import { Badge } from "@auction/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

export type { AdminLotTableRow, LotColumnSortConfig };

function lotInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function LotTitleCell({
  row,
  connectRequired = false,
}: {
  row: AdminLotTableRow;
  connectRequired?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {row.thumbnailUrl ? (
        <MediaImage
          src={row.thumbnailUrl}
          alt=""
          label={row.title}
          sizes="48px"
          className="size-12 shrink-0 overflow-hidden rounded-lg"
          imgClassName="size-full object-cover"
        />
      ) : (
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-shell-search-bg font-label text-xs font-semibold uppercase text-on-surface-variant"
          aria-hidden
        >
          {lotInitials(row.title)}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={adminLotHref(row.id)}
            className="block min-w-0 truncate font-headline text-sm font-semibold text-on-surface hover:text-link"
          >
            {row.title}
          </Link>
          {connectRequired ? (
            <Badge
              variant="outline"
              className="h-5 shrink-0 px-1.5 font-label text-[10px] font-medium uppercase tracking-wide"
            >
              Connect
            </Badge>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <p className="truncate font-label text-xs text-on-surface-variant">
            Lot #{row.lotNumber ?? "—"}
          </p>
          <LotAuctionTypeChip auctionType={row.auctionType} iconOnly className="shrink-0" />
        </div>
      </div>
    </div>
  );
}

export function lotColumns(
  sort?: LotColumnSortConfig,
  options?: {
    canManageCatalog?: boolean;
    canManageAuction?: boolean;
    connectRequiredByLotId?: ConnectRequiredByLotId;
  },
): ColumnDef<AdminLotTableRow>[] {
  return [
    {
      accessorKey: "title",
      header: sort
        ? () => (
            <AdminSortableColumnHeader
              label="Lot"
              sortValue="createdDesc"
              currentSort={sort.current}
              href={sort.hrefs.createdDesc}
            />
          )
        : "Lot",
      cell: ({ row }) => (
        <LotTitleCell
          row={row.original}
          connectRequired={options?.connectRequiredByLotId?.[row.original.id] === true}
        />
      ),
    },
    {
      id: "sale",
      header: "Sale",
      accessorFn: (row) => row.saleTitle ?? "",
      cell: ({ row }) => (
        <LotSaleContextCell
          saleId={row.original.saleId}
          saleTitle={row.original.saleTitle}
          saleStatus={row.original.saleStatus}
          saleDeliveryMode={row.original.saleDeliveryMode}
        />
      ),
    },
    {
      id: "estimate",
      header: "Estimate",
      accessorFn: (row) => row.estimateDisplay.primary,
      cell: ({ row }) => (
        <AdminTableMoneyCell display={row.original.estimateDisplay} emphasis="muted" />
      ),
    },
    {
      id: "photos",
      header: "Photos",
      accessorFn: (row) => row.imageCount,
      cell: ({ row }) =>
        row.original.imageCount === 0 ? (
          <span className="font-label text-xs text-destructive">No photos</span>
        ) : (
          <span className="font-label text-sm tabular-nums text-on-surface-variant">
            {row.original.imageCount}
          </span>
        ),
    },
    {
      id: "artist",
      header: "Artist",
      accessorFn: (row) => row.artistLabel ?? "",
      cell: ({ row }) => (
        <span className="block max-w-[10rem] truncate font-label text-sm text-on-surface-variant">
          {row.original.artistLabel ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <LotStatusCell status={row.original.status} />,
    },
    {
      accessorKey: "endTimeIso",
      header: sort
        ? () =>
            sort.current === "endedDesc" ? (
              <AdminSortableColumnHeader
                label="Ends"
                sortValue="endedDesc"
                currentSort={sort.current}
                href={sort.hrefs.endedDesc}
              />
            ) : (
              <AdminSortableColumnHeader
                label="Ends"
                sortValue="endingAsc"
                currentSort={sort.current}
                href={sort.hrefs.endingAsc}
                direction="asc"
              />
            )
        : "Ends",
      cell: ({ row }) => (
        <AdminTableDateTimeCell iso={row.original.endTimeIso} mode="deadline" live />
      ),
    },
    {
      accessorKey: "hammerDisplay",
      header: sort
        ? () => (
            <span className="block text-right">
              <AdminSortableColumnHeader
                label="Hammer"
                sortValue="hammerDesc"
                currentSort={sort.current}
                href={sort.hrefs.hammerDesc}
                className="justify-end"
              />
            </span>
          )
        : () => <span className="block text-right">Hammer</span>,
      cell: ({ row }) => (
        <AdminTableMoneyCell display={row.original.hammerDisplay} align="right" emphasis="hammer" />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <LotBoardMobileActionMenu
          row={row.original}
          {...(options?.canManageCatalog ? { canManageCatalog: true } : {})}
          {...(options?.canManageAuction ? { canManageAuction: true } : {})}
        />
      ),
      enableSorting: false,
    },
  ];
}
