"use client";

import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { ManualReviewPaymentActions } from "@/components/admin/manual-review-payment-actions";
import { isComplianceManualReviewReason } from "@/lib/admin/compliance-manual-review";
import { manualReviewReasonLabel } from "@/lib/admin/manual-review-presenter";
import type { AdminManualReviewPaymentRow } from "@/lib/data/http/admin.server";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Badge } from "@auction/ui/components/badge";
import Link from "next/link";

export function ManualReviewDrawerContent({
  payment,
  canOpenComplianceQueues = false,
}: {
  payment: AdminManualReviewPaymentRow;
  canOpenComplianceQueues?: boolean;
}) {
  const lotReference =
    payment.lotNumber == null ? "Lot details on full page" : `Lot ${payment.lotNumber}`;
  const compliance = isComplianceManualReviewReason(payment.manualReviewReason);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/lots/${payment.lotId}`}
          className="font-headline text-base text-link hover:underline"
        >
          {payment.lotTitle}
        </Link>
        <p className="text-sm text-on-surface-variant">{lotReference}</p>
        {payment.manualReviewReason ? (
          <Badge variant="secondary" className="mt-2">
            {manualReviewReasonLabel(payment.manualReviewReason)}
          </Badge>
        ) : null}
        <p className="mt-2 text-sm">
          <Link href={`/admin/clients/${payment.winnerUserId}`} className="text-link underline">
            {payment.winnerEmail?.trim() || "Buyer profile"}
          </Link>
          {compliance && canOpenComplianceQueues ? (
            <>
              {" · "}
              <Link
                href={
                  payment.manualReviewReason === "aml_hold"
                    ? "/admin/compliance/aml"
                    : "/admin/compliance/source-of-funds"
                }
                className="text-link underline"
              >
                Open compliance queue
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="font-label text-[10px] uppercase text-on-surface-variant">Amount</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {formatMoney(payment.amount, payment.currency)}
          </dd>
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

      <AdminTechnicalIdDisclosure
        items={[
          { label: "Payment ID", value: payment.paymentId },
          { label: "Lot ID", value: payment.lotId },
          { label: "Winner user ID", value: payment.winnerUserId },
        ]}
      />

      {!compliance ? (
        <Alert>
          <AlertTitle>Archive reason</AlertTitle>
          <AlertDescription>{payment.archiveReason ?? "No reason recorded."}</AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTitle>Compliance hold</AlertTitle>
          <AlertDescription>
            Settlement is blocked until MLRO clears the{" "}
            {payment.manualReviewReason === "aml_hold" ? "AML screening" : "Source of Funds case"}.
            Finance cannot release checkout while the hold is active.
          </AlertDescription>
        </Alert>
      )}
      <ManualReviewPaymentActions
        paymentId={payment.paymentId}
        manualReviewReason={payment.manualReviewReason}
      />
    </div>
  );
}
