"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { SaleroomHubSessionBadge } from "@/components/admin/saleroom-hub-board/saleroom-hub-session-badge";
import { SaleDeliveryModeBadge } from "@/features/saleroom/components/shared/sale-delivery-mode-badge";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import type { SaleDeliveryMode } from "@auction/types";
import { Button } from "@auction/ui";
import { toRequiredIsoString } from "@auction/validators";
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
        <div className="flex min-w-0 flex-col gap-0.5">
          <AdminTableDateTimeCell
            iso={toRequiredIsoString(row.original.sale.startTime)}
            mode="deadline"
            deadlineKind="start"
          />
          <AdminTableDateTimeCell
            iso={toRequiredIsoString(row.original.sale.endTime)}
            mode="deadline"
            live={row.original.sale.status === "active"}
          />
        </div>
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
