"use client";

import type { PayoutsStaffRow } from "@/lib/admin/finance/payouts-staff-list.vm";
import {
  CellLink,
  DetailPanel,
  Notice,
  type OverflowAction,
  OverflowMenu,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

/**
 * A payout beside the list: period and status, a meta line (seller, net amount, paid on), "Open
 * seller" and the same `…` menu as the row, then the money breakdown and anything Stripe or the
 * statement reported. The next money step sits in the footer; each opens the row's confirm dialog.
 */
export function PayoutQuickView({
  row,
  canProcess,
  canReverse,
  onClose,
  onMarkPaid,
  onAdjust,
  onRetryTransfer,
  onReverse,
  moneyActions = [],
}: {
  row: PayoutsStaffRow | null;
  canProcess: boolean;
  canReverse: boolean;
  onClose: () => void;
  onMarkPaid: (row: PayoutsStaffRow) => void;
  onAdjust: (row: PayoutsStaffRow) => void;
  onRetryTransfer: (row: PayoutsStaffRow) => void;
  onReverse: (row: PayoutsStaffRow) => void;
  /** The row menu's money actions, for the panel's `…`. */
  moneyActions?: readonly OverflowAction[];
}) {
  const sellerHref = row ? `/admin/legal-entities/${encodeURIComponent(row.legalEntityId)}` : "";
  const showFooter =
    row !== null &&
    ((canProcess && (row.canMarkPaid || row.canAdjust || row.canRetryTransfer)) ||
      (canReverse && row.canReverse));
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row ? `Payout for ${row.period}` : "Payout"}
      status={
        row ? (
          <StatusBadge
            tone={row.statusPresentation.tone}
            live={row.statusPresentation.live ?? false}
          >
            {row.statusPresentation.label}
          </StatusBadge>
        ) : null
      }
      summary={
        row
          ? [
              { label: "Gross", value: row.gross, numeric: true },
              { label: "Platform fee", value: row.platformFee, numeric: true },
              { label: "Stripe fee", value: row.stripeFee, numeric: true },
              { label: "Net", value: row.net, numeric: true },
              {
                label: "Seller",
                value: (
                  <CellLink href={sellerHref} Link={Link}>
                    {row.seller}
                  </CellLink>
                ),
              },
              {
                label: "Stripe transfer",
                value: row.stripeTransferId,
                ...(row.stripeTransferId ? { copyValue: row.stripeTransferId } : {}),
              },
              {
                label: "Paid",
                value: row.paidAt ? <StaffDate value={row.paidAt} withTime /> : null,
              },
              { label: "Created", value: <StaffDate value={row.createdAt} withTime /> },
              { label: "Payout ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
      meta={
        row
          ? [
              { label: "Seller", value: row.seller },
              ...(row.paidAt ? [{ label: "Paid", value: <StaffDate value={row.paidAt} /> }] : []),
            ]
          : []
      }
      headerActions={
        row ? (
          <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
            <Link href={sellerHref}>Open seller</Link>
          </StaffButton>
        ) : null
      }
      overflow={
        row && moneyActions.length > 0 ? (
          <OverflowMenu
            size="icon-sm"
            label={`More actions for the payout to ${row.seller}`}
            Link={Link}
            actions={moneyActions}
          />
        ) : null
      }
      footer={
        row && showFooter ? (
          <>
            {canReverse && row.canReverse ? (
              <StaffButton variant="danger-secondary" onClick={() => onReverse(row)}>
                Reverse {row.net}
              </StaffButton>
            ) : null}
            {canProcess && row.canAdjust ? (
              <StaffButton variant="secondary" onClick={() => onAdjust(row)}>
                Add adjustment
              </StaffButton>
            ) : null}
            {canProcess && row.canRetryTransfer ? (
              <StaffButton variant="primary" onClick={() => onRetryTransfer(row)}>
                Retry transfer
              </StaffButton>
            ) : null}
            {canProcess && row.canMarkPaid ? (
              <StaffButton variant="primary" onClick={() => onMarkPaid(row)}>
                Mark {row.net} paid
              </StaffButton>
            ) : null}
          </>
        ) : null
      }
    >
      {row ? (
        <>
          {row.failureReason ? (
            <Notice tone="danger" title="The Stripe transfer failed" className="mb-4">
              {row.failureReason}
            </Notice>
          ) : null}
          {row.status === "clawback_pending" ? (
            <Notice tone="danger" title="Funds need to be recovered" className="mb-4">
              This payout has a negative net amount. Recover the funds by reversal, offset or direct
              repayment before closing it.
            </Notice>
          ) : null}
          {row.statementError ? (
            <Notice tone="warning" title="The statement PDF is unavailable" className="mb-4">
              {row.statementError}
            </Notice>
          ) : null}
        </>
      ) : null}
    </DetailPanel>
  );
}
