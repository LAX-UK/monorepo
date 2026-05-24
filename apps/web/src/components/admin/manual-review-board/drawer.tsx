"use client";

import { ManualReviewPaymentActions } from "@/components/admin/manual-review-payment-actions";
import type { AdminManualReviewPaymentRow } from "@/lib/data/http/admin.server";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Badge } from "@auction/ui/components/badge";
import Link from "next/link";

function manualReviewReasonLabel(
  reason: AdminManualReviewPaymentRow["manualReviewReason"],
): string {
  switch (reason) {
    case "high_value":
      return "High value";
    case "seller_archived":
      return "Archived seller";
    case "seller_archived_and_high_value":
      return "Archived seller + high value";
    default:
      return "Manual review";
  }
}

export function ManualReviewDrawerContent({ payment }: { payment: AdminManualReviewPaymentRow }) {
  const lotReference = payment.lotNumber == null ? payment.lotId : `Lot ${payment.lotNumber}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/lots/${payment.lotId}`}
          className="font-headline text-base text-primary hover:underline"
        >
          {payment.lotTitle}
        </Link>
        <p className="text-sm text-on-surface-variant">{lotReference}</p>
        {payment.manualReviewReason ? (
          <Badge variant="secondary" className="mt-2">
            {manualReviewReasonLabel(payment.manualReviewReason)}
          </Badge>
        ) : null}
      </div>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Payment</dt>
          <dd className="font-mono text-xs break-all">{payment.paymentId}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Amount</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {formatMoney(payment.amount, payment.currency)}
          </dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Winner</dt>
          <dd>{payment.winnerEmail}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">
            Archived seller
          </dt>
          <dd>{payment.sellerDisplayName}</dd>
        </div>
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Archived at</dt>
          <dd>{formatDateTime(payment.archiveTimestamp ?? payment.sellerArchivedAt)}</dd>
        </div>
      </dl>
      <Alert>
        <AlertTitle>Archive reason</AlertTitle>
        <AlertDescription>{payment.archiveReason ?? "No reason recorded."}</AlertDescription>
      </Alert>
      <ManualReviewPaymentActions paymentId={payment.paymentId} />
    </div>
  );
}
