"use client";

import {
  ERASURE_REASON_MAX_LENGTH,
  type EnquiryErasureCounts,
  type ErasureDraft,
  type ErasureField,
  validateErasure,
} from "@/lib/admin/data-requests/enquiry-erasure";
import type { ActionResult } from "@/lib/forms/form-result";
import {
  Field,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffDialog,
  TextArea,
  TextInput,
} from "@auction/staff-ui";
import { Trash2 } from "@auction/staff-ui/icons";
import { useId, useRef, useState } from "react";

const NO_ANSWER = "The enquiries service gave no answer. Nothing was confirmed. Try again.";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
  /** Shown to staff and used to check what they type; the server uses its own copy of the address. */
  email: string;
  submit: (input: ErasureDraft) => Promise<ActionResult<EnquiryErasureCounts>>;
  onDone: (counts: EnquiryErasureCounts) => void;
};

/**
 * Erases the enquiries sent from one email address. It says what is lost and that it can't be
 * undone, and asks for the address typed again and a reason, which the audit keeps. Enquiries
 * that became a deal are kept; the result says how many.
 */
export function EraseEnquiriesDialog({
  open,
  onOpenChange,
  reference,
  email,
  submit,
  onDone,
}: Props) {
  const ids = useId();
  const formId = `${ids}-form`;
  const fieldIds: Record<ErasureField, string> = {
    confirmation: `${ids}-confirmation`,
    reason: `${ids}-reason`,
  };
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<ErasureDraft>({ confirmation: "", reason: "" });
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const errors = attempted ? validateErasure(draft, email) : {};
  const summary = (Object.keys(errors) as ErasureField[]).flatMap((field) =>
    errors[field] ? [{ fieldId: fieldIds[field], message: errors[field] as string }] : [],
  );

  async function proceed() {
    setAttempted(true);
    if (Object.keys(validateErasure(draft, email)).length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setFailure(null);
    setBusy(true);
    const result = await submit(draft);
    setBusy(false);
    if (result.ok && result.data) {
      onOpenChange(false);
      onDone(result.data);
    } else {
      setFailure(result.ok ? NO_ANSWER : result.error);
    }
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="md"
      initialFocusRef={cancelRef}
      title="Erase enquiries?"
      description={`Every enquiry sent from ${email} is anonymised. This can't be undone.`}
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton
            type="submit"
            form={formId}
            variant="danger"
            loading={busy}
            icon={<Trash2 aria-hidden />}
          >
            Erase enquiries
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={`Erase enquiries for ${reference}`}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void proceed();
        }}
      >
        <FormErrorSummary errors={summary} focusKey={failedSubmits} />
        {failure ? (
          <Notice tone="danger" alert title="The enquiries couldn't be erased">
            {failure}
          </Notice>
        ) : null}
        <p className="text-staff-sm text-staff-muted">
          Names, emails, phone numbers and messages are replaced, notes are cleared and attached
          files are deleted. Email-only alert subscriptions for this address are erased too.
          Enquiries that became a deal are kept until the deal closes.
        </p>
        <Field
          label="Type the email address to confirm"
          id={fieldIds.confirmation}
          error={errors.confirmation}
          disabled={busy}
        >
          <TextInput
            type="email"
            inputMode="email"
            autoComplete="off"
            value={draft.confirmation}
            onChange={(event) => setDraft((d) => ({ ...d, confirmation: event.target.value }))}
          />
        </Field>
        <Field
          label="Reason"
          id={fieldIds.reason}
          description="Kept in the audit log with the counts. Don't include personal details."
          error={errors.reason}
          disabled={busy}
        >
          <TextArea
            rows={3}
            value={draft.reason}
            maxLength={ERASURE_REASON_MAX_LENGTH}
            onChange={(event) => setDraft((d) => ({ ...d, reason: event.target.value }))}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
