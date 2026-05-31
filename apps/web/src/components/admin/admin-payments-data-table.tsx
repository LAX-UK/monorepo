"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import {
  adminCapturePaymentResultAction,
  adminRefundPaymentResultAction,
} from "@/lib/actions/admin";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import { notify } from "@/lib/ui/notify";
import type { PaymentStatus } from "@auction/types";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";

export type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";

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
      <div className="flex flex-col gap-3 border-t border-border-hairline pt-4">
        {(status === "pending" || status === "authorized") && (
          <ConfirmActionButton
            className="min-h-11 w-full"
            disabled={pending}
            confirmTitle="Capture payment?"
            confirmBody="This marks the payment as captured and completes settlement."
            confirmLabel="Capture"
            tone="info"
            onConfirmed={runCapture}
          >
            Capture
          </ConfirmActionButton>
        )}
        <ConfirmActionButton
          variant="destructive"
          className="min-h-11 w-full"
          disabled={pending}
          confirmTitle="Refund payment?"
          confirmBody="This refunds the buyer and cannot be undone from this screen."
          confirmLabel="Refund"
          onConfirmed={runRefund}
        >
          Refund
        </ConfirmActionButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-3">
      {(status === "pending" || status === "authorized") && (
        <ConfirmActionButton
          size="sm"
          disabled={pending}
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
          confirmTitle="Capture payment?"
          confirmBody="This marks the payment as captured."
          confirmLabel="Capture"
          tone="info"
          onConfirmed={runCapture}
        >
          Capture
        </ConfirmActionButton>
      )}
      <ConfirmActionButton
        variant="destructive"
        size="sm"
        disabled={pending}
        className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
        confirmTitle="Refund payment?"
        confirmBody="This refunds the buyer."
        confirmLabel="Refund"
        onConfirmed={runRefund}
      >
        Refund
      </ConfirmActionButton>
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
        <Link
          href={`/admin/clients/${row.original.buyerId}`}
          className="block max-w-[12rem] truncate text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {row.original.buyerLabel ?? `ID: ${row.original.buyerId.slice(0, 8)}…`}
        </Link>
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
            className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-2 hover:underline"
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
      cell: ({ row }) => <AdminStatusBadge domain="payment" status={row.original.status} />,
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
  return (
    <AdminDataTable
      ariaLabel="Payments"
      columns={columns}
      data={rows}
      emptyMessage="No payment records yet."
    />
  );
}
