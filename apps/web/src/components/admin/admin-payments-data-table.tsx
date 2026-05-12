"use client";

import {
  adminCapturePaymentResultAction,
  adminRefundPaymentResultAction,
} from "@/lib/actions/admin";
import { paymentStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import { notify } from "@/lib/ui/notify";
import type { PaymentStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DataTable } from "@auction/ui/components/data-table";
import { StatusBadge } from "@auction/ui/components/status-badge";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";

export type AdminPaymentTableRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  platformFee: string;
  status: PaymentStatus;
  /** Lot fulfilment pipeline status when the finance user can read the ops queue; otherwise null. */
  fulfilmentStatus: string | null;
  xeroInvoiceNumber: string | null;
  xeroOnlineInvoiceUrl: string | null;
  xeroSyncStatus: "pending_sync" | "synced" | "error" | null;
  xeroLastError: string | null;
};

function fulfilmentStatusLabel(status: string | null): string {
  if (!status) return "—";
  return status.replaceAll("_", " ");
}

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
          notify.success("Marked captured");
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  };
  const runRefund = () => {
    startTransition(() => {
      void (async () => {
        const r = await adminRefundPaymentResultAction(id);
        if (r.ok) {
          notify.success("Refunded");
          router.refresh();
          return;
        }
        notify.error(r.error);
      })();
    });
  };

  if (fullWidth) {
    return (
      <div className="flex flex-col gap-3 border-t border-outline-variant/15 pt-4">
        {(status === "pending" || status === "authorized") && (
          <Button type="button" className="min-h-11 w-full" disabled={pending} onClick={runCapture}>
            Capture
          </Button>
        )}
        <Button
          type="button"
          variant="destructive"
          className="min-h-11 w-full"
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
        <Button
          type="button"
          size="sm"
          disabled={pending}
          className="font-label text-xs uppercase tracking-widest disabled:opacity-50"
          onClick={runCapture}
        >
          Capture
        </Button>
      )}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        className="font-label text-xs uppercase tracking-widest disabled:opacity-50"
        onClick={runRefund}
      >
        Refund
      </Button>
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
      accessorKey: "fulfilmentStatus",
      header: "Fulfilment",
      cell: ({ row }) => (
        <span className="max-w-[10rem] font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
          {fulfilmentStatusLabel(row.original.fulfilmentStatus)}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "xero",
      header: "Xero",
      cell: ({ row }) =>
        row.original.xeroOnlineInvoiceUrl ? (
          <a
            href={row.original.xeroOnlineInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-xs uppercase tracking-widest text-primary underline-offset-2 hover:underline"
          >
            Invoice
          </a>
        ) : (
          <span className="text-on-surface-variant">—</span>
        ),
      enableSorting: false,
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
      cell: ({ row }) => <AdminPaymentActions id={row.original.id} status={row.original.status} />,
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
