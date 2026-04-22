"use client";

import { Button } from "@/components/ui/button";
import {
  adminCapturePaymentResultAction,
  adminRefundPaymentResultAction,
} from "@/lib/actions/admin";
import { paymentStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import type { PaymentStatus } from "@auction/types";
import { DataTable } from "@auction/ui/components/data-table";
import { StatusBadge } from "@auction/ui/components/status-badge";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";

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

type PaymentActionsProps = { id: string; status: PaymentStatus; fullWidth?: boolean };

export function AdminPaymentActions({ id, status, fullWidth }: PaymentActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (status === "refunded") {
    return <span className="text-on-surface-variant">Refunded</span>;
  }

  const runCapture = () => {
    startTransition(() => {
      void (async () => {
        const r = await adminCapturePaymentResultAction(id);
        if (r.ok) {
          toast.success("Marked captured");
          router.refresh();
          return;
        }
        toast.error(r.error);
      })();
    });
  };
  const runRefund = () => {
    startTransition(() => {
      void (async () => {
        const r = await adminRefundPaymentResultAction(id);
        if (r.ok) {
          toast.success("Refunded");
          router.refresh();
          return;
        }
        toast.error(r.error);
      })();
    });
  };

  if (fullWidth) {
    return (
      <div className="flex flex-col gap-3 border-t border-outline-variant/15 pt-4">
        {(status === "pending" || status === "authorized") && (
          <Button type="button" className="min-h-11 w-full" disabled={pending} onClick={runCapture}>
            Mark captured
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full text-error"
          disabled={pending}
          onClick={runRefund}
        >
          Refund
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-3">
      {(status === "pending" || status === "authorized") && (
        <button
          type="button"
          disabled={pending}
          className="font-label text-xs uppercase tracking-widest text-primary underline-offset-2 hover:underline disabled:opacity-50"
          onClick={runCapture}
        >
          Mark captured
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        className="font-label text-xs uppercase tracking-widest text-error underline-offset-2 hover:underline disabled:opacity-50"
        onClick={runRefund}
      >
        Refund
      </button>
    </div>
  );
}

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
      cell: ({ row }) => (
        <AdminPaymentActions id={row.original.id} status={row.original.status} />
      ),
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
