"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { isComplianceManualReviewReason } from "@/lib/admin/compliance-manual-review";
import {
  captureManualReviewPaymentAction,
  refundManualReviewPaymentAction,
} from "@/lib/admin/finance/admin-finance-mutations";
import type { AdminManualReviewPaymentRow } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription } from "@auction/ui/components/alert";

type Props = {
  paymentId: string;
  manualReviewReason: AdminManualReviewPaymentRow["manualReviewReason"];
};

export function ManualReviewPaymentActions({ paymentId, manualReviewReason }: Props) {
  const captureFormId = `capture-manual-review-${paymentId}`;
  const refundFormId = `refund-manual-review-${paymentId}`;
  const complianceHold = isComplianceManualReviewReason(manualReviewReason);

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
      <div className="flex flex-wrap gap-3">
        <form id={captureFormId} action={captureManualReviewPaymentAction}>
          <input type="hidden" name="paymentId" value={paymentId} />
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
        <form id={refundFormId} action={refundManualReviewPaymentAction}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <ConfirmFormSubmit
            formId={refundFormId}
            variant="outline"
            className="rounded-md border border-outline-variant px-4 py-2 font-label text-sm font-semibold text-error"
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
