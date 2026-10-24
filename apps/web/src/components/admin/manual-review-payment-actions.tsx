"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { IdempotencyKeyField } from "@/components/admin/idempotency-key-field";
import { isComplianceManualReviewReason } from "@/lib/admin/compliance-manual-review";
import {
  captureManualReviewPaymentAction,
  refundManualReviewPaymentAction,
} from "@/lib/admin/finance/admin-finance-mutations";
import type { AdminManualReviewPaymentRow } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";
import { ADMIN_REFUND_BUYER_REASON_MIN } from "@auction/validators";
import { useState } from "react";

type Props = {
  paymentId: string;
  manualReviewReason: AdminManualReviewPaymentRow["manualReviewReason"];
};

export function ManualReviewPaymentActions({ paymentId, manualReviewReason }: Props) {
  const captureFormId = `capture-manual-review-${paymentId}`;
  const refundFormId = `refund-manual-review-${paymentId}`;
  const refundReasonId = `${refundFormId}-reason`;
  const complianceHold = isComplianceManualReviewReason(manualReviewReason);
  const [refundReason, setRefundReason] = useState("");
  const refundReasonOk = refundReason.trim().length >= ADMIN_REFUND_BUYER_REASON_MIN;

  return (
    <div className="space-y-4">
      {complianceHold ? (
        <Alert variant="destructive">
          <AlertDescription>
            Release for checkout is blocked while AML or Source-of-Funds compliance holds apply.
            Clear the case in compliance review before retrying release.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-start gap-3">
        <form id={captureFormId} action={captureManualReviewPaymentAction}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <IdempotencyKeyField />
          <ConfirmFormSubmit
            formId={captureFormId}
            disabled={complianceHold}
            className="rounded-md bg-primary px-4 py-2 font-label text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
            confirmTitle="Release for checkout?"
            confirmBody="The buyer can retry checkout (typically UK bank transfer for high-value lots). No funds are captured until Stripe confirms payment."
            confirmLabel="Release"
            tone="warning"
          >
            Release for checkout
          </ConfirmFormSubmit>
        </form>
        <form id={refundFormId} action={refundManualReviewPaymentAction} className="space-y-2">
          <input type="hidden" name="paymentId" value={paymentId} />
          <IdempotencyKeyField />
          <div className="space-y-1">
            <Label htmlFor={refundReasonId}>Reason for the refund</Label>
            <Textarea
              id={refundReasonId}
              name="reason"
              rows={2}
              maxLength={500}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              aria-describedby={`${refundReasonId}-hint`}
            />
            <p id={`${refundReasonId}-hint`} className="font-body text-xs text-on-surface-variant">
              At least {ADMIN_REFUND_BUYER_REASON_MIN} characters. It is kept in the audit log.
            </p>
          </div>
          <ConfirmFormSubmit
            formId={refundFormId}
            variant="outline"
            disabled={!refundReasonOk}
            className="rounded-md border border-outline-variant px-4 py-2 font-label text-sm font-semibold text-error disabled:cursor-not-allowed disabled:opacity-50"
            confirmTitle="Refund buyer?"
            confirmBody="The winning payment will be refunded and the lot will not settle."
            confirmLabel="Refund"
            tone="danger"
          >
            Refund buyer
          </ConfirmFormSubmit>
        </form>
      </div>
    </div>
  );
}
