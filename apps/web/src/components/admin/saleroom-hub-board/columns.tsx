"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { SaleroomHubSessionBadge } from "@/components/admin/saleroom-hub-board/saleroom-hub-session-badge";
import { SaleDeliveryModeBadge } from "@/features/saleroom/components/shared/sale-delivery-mode-badge";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import type { SaleDeliveryMode } from "@auction/types";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

type Row = AdminSaleListRow;

export function saleroomHubColumns(): ColumnDef<Row>[] {
  return [
    {
      accessorKey: "sale.title",
      header: "Sale",
      cell: ({ row }) => (
        <Link
          href={`/admin/saleroom/${row.original.sale.id}`}
          className="font-medium text-link hover:underline"
        >
          {row.original.sale.title}
        </Link>
      ),
    },
    {
      id: "delivery",
      header: "Delivery",
      cell: ({ row }) => (
        <SaleDeliveryModeBadge mode={row.original.sale.deliveryMode as SaleDeliveryMode} />
      ),
      enableSorting: false,
    },
    {
      id: "schedule",
      header: "Schedule",
      cell: ({ row }) => (
        <span className="text-xs text-on-surface-variant">
          {row.original.sale.startTime ? formatDateTime(row.original.sale.startTime) : "—"} →{" "}
          {row.original.sale.endTime ? formatDateTime(row.original.sale.endTime) : "—"}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "session",
      header: "Session",
      cell: ({ row }) => <SaleroomHubSessionBadge saleId={row.original.sale.id} />,
      enableSorting: false,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="sale" status={row.original.sale.status} />,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/admin/saleroom/${row.original.sale.id}`}>Clerk console</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`${saleDetailTabHref(row.original.sale.id, "registrations")}#check-in`}>
              Check-in
            </Link>
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];
}
