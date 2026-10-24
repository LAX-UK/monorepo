"use client";

import { adminPaymentXeroSyncResultAction } from "@/lib/actions/admin";
import type { PaymentsStaffRow } from "@/lib/admin/finance/payments-staff-list.vm";
import { xeroSyncStatusLabel } from "@/lib/admin/xero-sync-status-presenter";
import { notify } from "@/lib/ui/notify";
import {
  CellLink,
  DetailPanel,
  KeyValueList,
  MetaItem,
  Notice,
  type OverflowAction,
  OverflowMenu,
  PanelSection,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * A payment beside the list, in the record header pattern: lot title and status, a meta line
 * (buyer, amount, created), "Open lot" and the same `…` menu as the row, then the summary and
 * Xero. The next money step sits in the footer; every money action opens the row's confirm dialog.
 */
export function PaymentQuickView({
  row,
  canWritePayments,
  onClose,
  onCapture,
  onRefund,
  moneyActions = [],
}: {
  row: PaymentsStaffRow | null;
  canWritePayments: boolean;
  onClose: () => void;
  onCapture: (row: PaymentsStaffRow) => void;
  onRefund: (row: PaymentsStaffRow) => void;
  /** The row menu's money actions, for the panel's `…`. */
  moneyActions?: readonly OverflowAction[];
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
      {...(row?.lotContext ? { description: row.lotContext } : {})}
      meta={
        row ? (
          <>
            <MetaItem label="Buyer">{row.buyer}</MetaItem>
            <MetaItem label="Amount">{row.amount}</MetaItem>
            {row.createdAt ? (
              <MetaItem label="Created">
                <StaffDate value={row.createdAt} />
              </MetaItem>
            ) : null}
          </>
        ) : null
      }
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
      overflow={
        row ? (
          <OverflowMenu
            size="icon-sm"
            label={`More actions for payment ${row.lotTitle}`}
            Link={Link}
            actions={[
              {
                id: "buyer",
                label: "Open buyer",
                href: `/admin/clients/${encodeURIComponent(row.buyerId)}`,
              },
              ...moneyActions,
            ]}
          />
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
          <PanelSection title="Summary">
            <KeyValueList
              items={[
                { label: "Amount", value: row.amount, numeric: true },
                { label: "Platform fee", value: row.platformFee, numeric: true },
                {
                  label: "Buyer",
                  value: (
                    <CellLink
                      href={`/admin/clients/${encodeURIComponent(row.buyerId)}`}
                      Link={Link}
                    >
                      {row.buyer}
                    </CellLink>
                  ),
                },
                {
                  label: "Seller",
                  value: (
                    <CellLink
                      href={`/admin/clients/${encodeURIComponent(row.sellerId)}`}
                      Link={Link}
                    >
                      Seller profile
                    </CellLink>
                  ),
                },
                {
                  label: "Created",
                  value: row.createdAt ? <StaffDate value={row.createdAt} withTime /> : null,
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
                    <CellLink href={row.xero.invoiceUrl} external>
                      {row.xero.invoiceNumber ?? "Open invoice"}
                    </CellLink>
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
