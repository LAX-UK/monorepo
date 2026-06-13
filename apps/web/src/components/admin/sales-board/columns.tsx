"use client";

import { AdminSortableColumnHeader } from "@/components/admin/admin-sortable-column-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { adminSaleHref } from "@/lib/admin/catalog-route-helpers";
import { Sparkline } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { SaleBoardMobileActionMenu } from "./mobile-action-menu";
import type { AdminSaleBoardRow, SaleColumnSortConfig } from "./types";

export function saleBoardColumns(
  sort: SaleColumnSortConfig | undefined,
  canManageSales: boolean,
): ColumnDef<AdminSaleBoardRow>[] {
  return [
    {
      accessorKey: "title",
      header: sort
        ? () => (
            <AdminSortableColumnHeader
              label="Sale"
              sortValue="createdDesc"
              currentSort={sort.current}
              href={sort.hrefs.createdDesc}
            />
          )
        : "Sale",
      cell: ({ row }) => (
        <Link
          href={adminSaleHref(row.original.saleId)}
          className="font-headline text-base text-on-surface hover:text-link"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="sale" status={row.original.status} />,
    },
    {
      id: "lots",
      header: "Lots",
      accessorKey: "lotCount",
      cell: ({ row }) => (
        <span className="font-label text-xs tabular-nums text-on-surface-variant">
          {row.original.lotCount}
        </span>
      ),
    },
    {
      id: "starts",
      header: sort
        ? () => (
            <AdminSortableColumnHeader
              label="Starts"
              sortValue="startAsc"
              currentSort={sort.current}
              href={sort.hrefs.startAsc}
              direction="asc"
            />
          )
        : "Starts",
      cell: ({ row }) => (
        <time dateTime={row.original.startTimeIso} className="text-xs text-on-surface-variant">
          {row.original.startTimeLabel}
        </time>
      ),
      enableSorting: false,
    },
    {
      id: "spark",
      header: "Lot endings (7d)",
      cell: ({ row }) => (
        <Sparkline values={row.original.sparklineValues} width={80} height={28} tone="lot-orange" />
      ),
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <SaleBoardMobileActionMenu row={row.original} canManageSales={canManageSales} />
      ),
      enableSorting: false,
    },
  ];
}
