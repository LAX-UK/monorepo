"use client";

import { adminCapturePaymentAction, adminRefundPaymentAction } from "@/lib/actions/admin";
import { paymentStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import type { PaymentStatus } from "@auction/types";
import { DataTable } from "@auction/ui/components/data-table";
import { StatusBadge } from "@auction/ui/components/status-badge";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

export type AdminPaymentTableRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  platformFee: string;
  status: PaymentStatus;
};

function paymentColumns(): ColumnDef<AdminPaymentTableRow>[] {
  return [
    {
      accessorKey: "lotTitle",
      header: "Lot",
      cell: ({ row }) => <span>{row.original.lotTitle}</span>,
    },
    {
      accessorKey: "buyerId",
      header: "Buyer",
      cell: ({ row }) => (
        <span className="max-w-[10rem] truncate font-mono text-xs">{row.original.buyerId}</span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => <span className="tabular-nums">{row.original.amount}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge variant={paymentStatusToBadgeVariant(row.original.status)}>
          {row.original.status}
        </StatusBadge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const p = row.original;
        if (p.status === "refunded") {
          return <span className="text-on-surface-variant">Refunded</span>;
        }
        return (
          <div className="flex flex-wrap justify-end gap-3">
            {(p.status === "pending" || p.status === "authorized") && (
              <form action={adminCapturePaymentAction} className="inline">
                <input type="hidden" name="paymentId" value={p.id} />
                <button
                  type="submit"
                  className="font-label text-xs uppercase tracking-widest text-primary underline-offset-2 hover:underline"
                >
                  Mark captured
                </button>
              </form>
            )}
            <form action={adminRefundPaymentAction} className="inline">
              <input type="hidden" name="paymentId" value={p.id} />
              <button
                type="submit"
                className="font-label text-xs uppercase tracking-widest text-error underline-offset-2 hover:underline"
              >
                Refund
              </button>
            </form>
          </div>
        );
      },
      enableSorting: false,
    },
  ];
}

type Props = {
  rows: AdminPaymentTableRow[];
};

export function AdminPaymentsDataTable({ rows }: Props) {
  const columns = useMemo(() => paymentColumns(), []);
  return <DataTable columns={columns} data={rows} emptyMessage="No payment records yet." />;
}
