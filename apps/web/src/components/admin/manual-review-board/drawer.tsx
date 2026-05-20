"use client";

import { ManualReviewPaymentActions } from "@/components/admin/manual-review-payment-actions";
import type { AdminManualReviewPaymentRow } from "@/lib/data/http/admin.server";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

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
