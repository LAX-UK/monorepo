"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
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
          className="font-medium text-primary hover:underline"
        >
          {row.original.sale.title}
        </Link>
      ),
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
      id: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="sale" status={row.original.sale.status} />,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/admin/saleroom/${row.original.sale.id}`}>Clerk console</Link>
        </Button>
      ),
      enableSorting: false,
    },
  ];
}
