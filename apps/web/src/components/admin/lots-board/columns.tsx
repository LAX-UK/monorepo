"use client";

import { AdminSortableColumnHeader } from "@/components/admin/admin-sortable-column-header";
import { LotStatusCell } from "@/components/admin/lots-board/lot-status-cell";
import { LotBoardMobileActionMenu } from "@/components/admin/lots-board/mobile-action-menu";
import type { AdminLotTableRow, LotColumnSortConfig } from "@/components/admin/lots-board/types";
import { adminLotHref } from "@/lib/admin/catalog-route-helpers";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { formatDateTime } from "@/lib/ui/format";

export type { AdminLotTableRow, LotColumnSortConfig };

export function lotColumns(
  sort?: LotColumnSortConfig,
  options?: { canManageCatalog?: boolean },
): ColumnDef<AdminLotTableRow>[] {
  return [
    {
      accessorKey: "title",
      header: sort
        ? () => (
            <AdminSortableColumnHeader
              label="Title"
              sortValue="createdDesc"
              currentSort={sort.current}
              href={sort.hrefs.createdDesc}
            />
          )
        : "Title",
      cell: ({ row }) => (
        <Link
          href={adminLotHref(row.original.id)}
          className="font-medium text-primary hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "auctionType",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-on-surface-variant">{row.original.auctionType}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <LotStatusCell lotId={row.original.id} status={row.original.status} />,
    },
    {
      id: "lastActivity",
      header: "Last activity",
      cell: ({ row }) =>
        row.original.lastActivityLabel ? (
          <div className="text-xs text-on-surface-variant">
            <p className="text-on-surface">{row.original.lastActivityLabel}</p>
            {row.original.lastActivityAt ? (
              <time dateTime={row.original.lastActivityAt}>
                {formatDateTime(new Date(row.original.lastActivityAt))}
              </time>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-on-surface-variant">—</span>
        ),
    },
    {
      accessorKey: "endTimeLabel",
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
        <time dateTime={row.original.endTimeIso} className="text-xs text-on-surface-variant">
          {row.original.endTimeLabel}
        </time>
      ),
    },
    {
      accessorKey: "currentPrice",
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
        <span className="block text-right tabular-nums">{row.original.currentPrice}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <LotBoardMobileActionMenu
          row={row.original}
          {...(options?.canManageCatalog ? { canManageCatalog: true } : {})}
        />
      ),
      enableSorting: false,
    },
  ];
}
