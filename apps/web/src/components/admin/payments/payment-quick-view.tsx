"use client";

import { adminPaymentXeroSyncResultAction } from "@/lib/actions/admin";
import type { PaymentsStaffRow } from "@/lib/admin/finance/payments-staff-list.vm";
import { xeroSyncStatusLabel } from "@/lib/admin/xero-sync-status-presenter";
import { notify } from "@/lib/ui/notify";
import {
  DetailPanel,
  KeyValueList,
  Notice,
  PanelSection,
  StaffButton,
  StatusBadge,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * A payment beside the list: amount, parties, fulfilment and Xero, with capture and refund in the
 * footer. Both open the same confirm dialogs as the row menu.
 */
export function PaymentQuickView({
  row,
  canWritePayments,
  onClose,
  onCapture,
  onRefund,
}: {
  row: PaymentsStaffRow | null;
  canWritePayments: boolean;
  onClose: () => void;
  onCapture: (row: PaymentsStaffRow) => void;
  onRefund: (row: PaymentsStaffRow) => void;
}) {
  const router = useRouter();
  const [syncing, startSync] = useTransition();
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.lotTitle ?? "Payment"}
      description={row ? `${row.buyer} · ${row.amount}` : undefined}
      status={
        row ? (
          <StatusBadge tone={row.statusPresentation.tone}>
            {row.statusPresentation.label}
          </StatusBadge>
        ) : null
      }
      headerActions={
        row ? (
          <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
            <Link href={`/admin/lots/${row.lotId}`}>Open lot</Link>
          </StaffButton>
        ) : null
      }
      footer={
        row && canWritePayments && (row.canRefund || row.canCapture) ? (
          <>
            {row.canRefund ? (
              <StaffButton variant="danger-secondary" onClick={() => onRefund(row)}>
                Refund {row.amount}
              </StaffButton>
            ) : null}
            {row.canCapture ? (
              <StaffButton variant="primary" onClick={() => onCapture(row)}>
                Capture {row.amount}
              </StaffButton>
            ) : null}
          </>
        ) : null
      }
    >
      {row ? (
        <>
          <PanelSection title="Payment">
            <KeyValueList
              items={[
                { label: "Amount", value: row.amount, numeric: true },
                { label: "Platform fee", value: row.platformFee, numeric: true },
                {
                  label: "Buyer",
                  value: (
                    <Link
                      href={`/admin/clients/${encodeURIComponent(row.buyerId)}`}
                      className="staff-focus rounded-staff-xs underline-offset-2 hover:underline"
                    >
                      {row.buyer}
                    </Link>
                  ),
                },
                {
                  label: "Seller",
                  value: (
                    <Link
                      href={`/admin/clients/${encodeURIComponent(row.sellerId)}`}
                      className="staff-focus rounded-staff-xs underline-offset-2 hover:underline"
                    >
                      Seller profile
                    </Link>
                  ),
                },
                {
                  label: "Created",
                  value: row.createdAt ? formatStaffDateTime(row.createdAt) : null,
                },
                {
                  label: "Fulfilment",
                  value: row.fulfilment ? (
                    <StatusBadge tone={row.fulfilment.tone}>{row.fulfilment.label}</StatusBadge>
                  ) : null,
                },
                { label: "Payment ID", value: row.id, copyValue: row.id },
              ]}
            />
          </PanelSection>
          <PanelSection
            title="Xero"
            action={
              <StaffButton
                size="sm"
                variant="ghost"
                icon={<RefreshCw aria-hidden />}
                loading={syncing}
                onClick={() =>
                  startSync(async () => {
                    const result = await adminPaymentXeroSyncResultAction(row.id);
                    if (!result.ok) {
                      notify.error(result.error);
                      return;
                    }
                    notify.success("Synced from Xero");
                    router.refresh();
                  })
                }
              >
                Sync
              </StaffButton>
            }
          >
            {row.xero.lastError ? (
              <Notice tone="danger" title="The last sync failed" className="mb-2">
                {row.xero.lastError}
              </Notice>
            ) : null}
            <KeyValueList
              items={[
                {
                  label: "Invoice",
                  value: row.xero.invoiceUrl ? (
                    <a
                      href={row.xero.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="staff-focus rounded-staff-xs underline-offset-2 hover:underline"
                    >
                      {row.xero.invoiceNumber ?? "Open invoice"}
                    </a>
                  ) : (
                    (row.xero.invoiceNumber ?? "Not linked yet")
                  ),
                },
                {
                  label: "Sync",
                  value: row.xero.syncStatus ? xeroSyncStatusLabel(row.xero.syncStatus) : null,
                },
              ]}
            />
          </PanelSection>
        </>
      ) : null}
    </DetailPanel>
  );
}
