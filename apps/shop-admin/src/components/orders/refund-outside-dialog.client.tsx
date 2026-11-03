"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { settleRefundOutsideLax } from "@/server/application/admin-operations-actions.server";
import {
  SETTLED_OUTSIDE_REASON_MAX_LENGTH,
  SETTLED_OUTSIDE_REFERENCE_MAX_LENGTH,
} from "@auction/shop-contracts";
import {
  Field,
  FormErrorSummary,
  KeyValueList,
  StaffButton,
  StaffDialog,
  TextArea,
  TextInput,
  formatGbp,
} from "@auction/staff-ui";
import { useId, useRef, useState } from "react";

type Errors = Partial<Record<"reference" | "reason", string>>;

/** Both fields are needed before anything is sent; the record must say where and why. */
export function validateRefundedOutside(input: { reference: string; reason: string }): Errors {
  const errors: Errors = {};
  if (!input.reference.trim()) {
    errors.reference = "Enter the reference of the refund, such as the Stripe refund ID.";
  }
  if (!input.reason.trim()) errors.reason = "Say why the customer was refunded outside LAX.";
  return errors;
}

/**
 * Marks a refund that failed as paid, because finance refunded the customer another way (for
 * example from the Stripe dashboard). It asks where the refund can be found and why, repeats the
 * amount on the button, and warns that it cannot be undone. Money moves, so a recent sign-in is
 * required and the kit's "Confirm it's you" dialog handles it.
 */
export function RefundedOutsideDialog({
  refundId,
  amountPence,
  itemLabel,
  failureReason,
  open,
  onOpenChange,
}: {
  refundId: string;
  amountPence: number;
  itemLabel: string;
  failureReason: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = useAdminAction();
  const formId = useId();
  const referenceRef = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [submits, setSubmits] = useState(0);
  const submitted = submits > 0;
  const errors = submitted ? validateRefundedOutside({ reference, reason }) : {};
  const amount = formatGbp(amountPence);

  const submit = async () => {
    setSubmits((count) => count + 1);
    if (Object.keys(validateRefundedOutside({ reference, reason })).length > 0) return;
    const ok = await action.run(
      () =>
        settleRefundOutsideLax({
          refundId,
          reason: reason.trim(),
          externalReference: reference.trim(),
          idempotencyKey: action.idempotencyKey,
        }),
      `Refund of ${amount} marked as refunded outside LAX`,
      `mark ${amount} as refunded outside LAX`,
    );
    if (ok) {
      setReference("");
      setReason("");
      setSubmits(0);
      onOpenChange(false);
    }
  };

  return (
    <>
      <StaffDialog
        open={open}
        onOpenChange={onOpenChange}
        size="md"
        initialFocusRef={referenceRef}
        title="Mark as refunded outside LAX"
        description="Use this only when the customer has already been refunded another way. LAX then counts this refund as paid and closes the hold on the artist's payout for the item. It cannot be undone."
        footer={
          <>
            <StaffButton
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={action.pending}
            >
              Cancel
            </StaffButton>
            <StaffButton variant="danger" type="submit" form={formId} loading={action.pending}>
              {`Mark ${amount} as refunded`}
            </StaffButton>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <FormErrorSummary
            errors={Object.entries(errors).map(([field, message]) => ({
              fieldId: `refunded-outside-${field}`,
              message: message ?? "",
            }))}
            focusKey={submits}
          />
          {action.error}
          <KeyValueList
            items={[
              { label: "Refund", value: amount, numeric: true },
              { label: "For", value: itemLabel },
              ...(failureReason ? [{ label: "Why it failed", value: failureReason }] : []),
            ]}
          />
          <Field
            id="refunded-outside-reference"
            label="Refund reference"
            description="Where the refund can be found, such as the refund ID from the Stripe dashboard."
            error={errors.reference}
          >
            <TextInput
              ref={referenceRef}
              value={reference}
              autoComplete="off"
              spellCheck={false}
              maxLength={SETTLED_OUTSIDE_REFERENCE_MAX_LENGTH}
              placeholder="re_…"
              onChange={(event) => setReference(event.target.value)}
            />
          </Field>
          <Field
            id="refunded-outside-reason"
            label="Reason"
            description="Kept on the order's record, for staff."
            error={errors.reason}
          >
            <TextArea
              rows={3}
              maxLength={SETTLED_OUTSIDE_REASON_MAX_LENGTH}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </form>
      </StaffDialog>
      {action.stepUpDialog}
    </>
  );
}
