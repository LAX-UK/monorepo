"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import { requestOrderRefund } from "@/server/application/admin-operations-actions.server";
import {
  REFUND_REASON_OPTIONS,
  refundTargetOptions,
  refundableRemainingPence,
} from "@/server/domain/order-detail.vm";
import { orderNumber } from "@/server/domain/order-list.vm";
import {
  ADMIN_REFUND_NOTE_MAX_LENGTH,
  type AdminOrderDetail,
  type AdminRefundReason,
} from "@auction/shop-contracts";
import {
  EntityPicker,
  EnumSelect,
  Field,
  FormErrorSummary,
  MoneyInput,
  StaffButton,
  StaffDialog,
  TextArea,
  formatGbp,
} from "@auction/staff-ui";
import { CircleAlert } from "@auction/staff-ui/icons";
import { useState } from "react";

type Errors = Partial<Record<"amount" | "reason", string>>;

/** Validates the refund before anything is sent; amounts are pence, shown as pounds. */
export function validateRefund(input: {
  amountPence: number | null;
  amountText: boolean;
  reason: AdminRefundReason | null;
  remainingPence: number;
}): Errors {
  const errors: Errors = {};
  if (input.amountPence === null) {
    errors.amount = input.amountText
      ? "Enter an amount in pounds, like 25 or 25.50."
      : "Enter how much to refund.";
  } else if (input.amountPence < 1) {
    errors.amount = "Enter an amount of at least £0.01.";
  } else if (input.amountPence > input.remainingPence) {
    errors.amount = `At most ${formatGbp(input.remainingPence)} can still be refunded.`;
  }
  if (!input.reason) errors.reason = "Choose why you are refunding.";
  return errors;
}

/**
 * Refund in pounds, with a reason. Pick the whole order or one item; the most that can still be
 * refunded is shown and checked as you type. The button repeats the amount, and the payment
 * provider is only asked once the form is valid.
 */
export function RefundDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: AdminOrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useAdminMutation();
  const [target, setTarget] = useState<string>("");
  const [amountPence, setAmountPence] = useState<number | null>(null);
  const [amountTyped, setAmountTyped] = useState(false);
  const [reason, setReason] = useState<AdminRefundReason | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  const lineId = target || null;
  const remaining = refundableRemainingPence(detail, lineId);
  const live = submitted
    ? validateRefund({ amountPence, amountText: amountTyped, reason, remainingPence: remaining })
    : errors;

  const reset = () => {
    setTarget("");
    setAmountPence(null);
    setAmountTyped(false);
    setReason(null);
    setNote("");
    setErrors({});
    setSubmitted(false);
  };

  const submit = async () => {
    setSubmitted(true);
    const next = validateRefund({
      amountPence,
      amountText: amountTyped,
      reason,
      remainingPence: remaining,
    });
    setErrors(next);
    if (Object.keys(next).length > 0 || amountPence === null || !reason) return;
    const ok = await mutation.run(
      () =>
        requestOrderRefund({
          orderId: detail.orderId,
          amountPence,
          ...(lineId ? { orderLineId: lineId } : {}),
          reason,
          ...(note.trim() ? { note: note.trim() } : {}),
          idempotencyKey: mutation.idempotencyKey,
        }),
      `Refund of ${formatGbp(amountPence)} requested`,
    );
    if (ok) {
      reset();
      onOpenChange(false);
    }
  };

  const summaryErrors = submitted
    ? Object.entries(live).map(([field, message]) => ({
        fieldId: `refund-${field}`,
        message: message ?? "",
      }))
    : [];

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      size="md"
      title={`Refund order ${orderNumber(detail.orderId)}`}
      description="The payment provider returns the money to the card the customer paid with. A refund cannot be undone once it has been processed."
      footer={
        <>
          <StaffButton
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={mutation.pending}
          >
            Cancel
          </StaffButton>
          <StaffButton variant="danger" type="submit" form="refund-form" loading={mutation.pending}>
            {amountPence ? `Refund ${formatGbp(amountPence)}` : "Refund"}
          </StaffButton>
        </>
      }
    >
      <form
        id="refund-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FormErrorSummary errors={summaryErrors.length > 1 ? summaryErrors : []} />
        {mutation.message ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-staff-md bg-staff-danger-bg px-3 py-2.5 text-staff-sm text-staff-danger-fg"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {mutation.message}
              {mutation.stepUpRequired ? (
                <>
                  {" "}
                  <a href={mutation.stepUpHref} className="font-medium underline">
                    Sign in again
                  </a>
                </>
              ) : null}
            </span>
          </p>
        ) : null}
        <Field label="Refund" description="The whole order, or one item on it.">
          <EntityPicker
            value={target}
            onValueChange={(option) => setTarget(option?.id ?? "")}
            options={refundTargetOptions(detail)}
            searchPlaceholder="Search items…"
          />
        </Field>
        <Field
          id="refund-amount"
          label="Amount"
          description={`Up to ${formatGbp(remaining)} can still be refunded.`}
          error={live.amount}
        >
          <div className="flex items-center gap-2">
            <MoneyInput
              value={amountPence}
              onValueChange={(pence) => setAmountPence(pence)}
              onInput={(event) => setAmountTyped(Boolean(event.currentTarget.value.trim()))}
              placeholder="0.00"
              boxClassName="max-w-48"
            />
            <StaffButton
              variant="ghost"
              size="sm"
              disabled={remaining === 0}
              onClick={() => {
                setAmountPence(remaining);
                setAmountTyped(true);
              }}
            >
              Refund {formatGbp(remaining)}
            </StaffButton>
          </div>
        </Field>
        <Field id="refund-reason" label="Reason" error={live.reason}>
          <EnumSelect
            value={reason}
            onValueChange={setReason}
            options={REFUND_REASON_OPTIONS}
            placeholder="Choose a reason"
          />
        </Field>
        <Field
          label="Note for the record"
          optional
          description="Visible to staff on the order's activity, not to the customer."
        >
          <TextArea
            rows={2}
            maxLength={ADMIN_REFUND_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
