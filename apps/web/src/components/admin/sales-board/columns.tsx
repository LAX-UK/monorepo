"use client";

import { AdminSortableColumnHeader } from "@/components/admin/admin-sortable-column-header";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { SaleDeliveryModeChip } from "@/components/admin/sale-delivery-mode-chip";
import { SaleStatusPill } from "@/components/admin/sale-detail/sale-status-pill";
import { MediaImage } from "@/components/ui/media-image";
import { adminSaleHref } from "@/lib/admin/catalog-route-helpers";
import { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { SaleBoardMobileActionMenu } from "./mobile-action-menu";
import type { AdminSaleBoardRow, SaleColumnSortConfig } from "./types";

function saleInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function SaleTitleCell({ row }: { row: AdminSaleBoardRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {row.coverImageUrl ? (
        <MediaImage
          src={row.coverImageUrl}
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
          {saleInitials(row.title)}
        </div>
      )}
      <div className="min-w-0">
        <Link
          href={adminSaleHref(row.saleId)}
          className="block truncate font-headline text-sm font-semibold text-on-surface hover:text-link"
        >
          {row.title}
        </Link>
        <p className="truncate font-label text-xs text-on-surface-variant">ID: {row.saleId}</p>
      </div>
    </div>
  );
}

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
              label="Title"
              sortValue="createdDesc"
              currentSort={sort.current}
              href={sort.hrefs.createdDesc}
            />
          )
        : "Title",
      cell: ({ row }) => <SaleTitleCell row={row.original} />,
    },
    {
      id: "type",
      header: "Type",
      accessorFn: (row) => deliveryModeShortLabel(row.deliveryMode),
      cell: ({ row }) => <SaleDeliveryModeChip deliveryMode={row.original.deliveryMode} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <SaleStatusPill status={row.original.status} />,
    },
    {
      id: "lots",
      header: "Lots",
      accessorKey: "lotCount",
      cell: ({ row }) => (
        <span className="font-label text-sm tabular-nums text-on-surface">
          {row.original.lotCount}
        </span>
      ),
    },
    {
      id: "start",
      header: sort
        ? () => (
            <AdminSortableColumnHeader
              label="Start"
              sortValue="startAsc"
              currentSort={sort.current}
              href={sort.hrefs.startAsc}
              direction="asc"
            />
          )
        : "Start",
      cell: ({ row }) => (
        <AdminTableDateTimeCell
          iso={row.original.startTimeIso}
          mode="deadline"
          deadlineKind="start"
        />
      ),
      enableSorting: false,
    },
    {
      id: "ending",
      header: "End date",
      cell: ({ row }) => (
        <AdminTableDateTimeCell
          iso={row.original.endTimeIso}
          mode="deadline"
          live={row.original.status === "active" || row.original.status === "scheduled"}
        />
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
