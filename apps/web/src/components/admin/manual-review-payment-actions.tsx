"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import {
  captureManualReviewPaymentAction,
  refundManualReviewPaymentAction,
} from "@/lib/admin/payment.actions";

type Props = { paymentId: string };

export function ManualReviewPaymentActions({ paymentId }: Props) {
  const captureFormId = `capture-manual-review-${paymentId}`;
  const refundFormId = `refund-manual-review-${paymentId}`;

  return (
    <div className="flex flex-wrap gap-3">
      <form id={captureFormId} action={captureManualReviewPaymentAction}>
        <input type="hidden" name="paymentId" value={paymentId} />
        <ConfirmFormSubmit
          formId={captureFormId}
          className="rounded-md bg-primary px-4 py-2 font-label text-sm font-semibold text-on-primary"
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
  );
}
