"use client";

import {
  ENQUIRY_CLOSE_REASONS_IN_ORDER,
  ENQUIRY_CLOSE_REASON_HINTS,
  ENQUIRY_CLOSE_REASON_LABELS,
} from "@/lib/admin/enquiries/enquiries.vm";
import {
  type CloseDraft,
  type CloseField,
  validateClose,
} from "@/lib/admin/enquiries/enquiry-forms";
import type { EnquiryCloseReason } from "@auction/domain";
import {
  ChoiceFieldset,
  ChoiceRow,
  Field,
  FormErrorSummary,
  StaffButton,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
} from "@auction/staff-ui";
import { useEffect, useId, useRef, useState } from "react";
import { EnquiryWriteFailureNotice } from "./enquiry-write-failure";
import type { EnquiryWriteFailure } from "./enquiry-write-failure";
import { type EnquiryWrites, failureOf } from "./use-enquiry-writes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
  submit: EnquiryWrites["patch"];
  onReload: () => void;
  onDone: (reason: EnquiryCloseReason) => void;
};

/**
 * Closes an enquiry with the reason staff report on. The note is optional and is kept as an
 * internal note. A closed enquiry can be reopened, so this is a confirmation, not a deletion.
 */
export function CloseEnquiryDialog({
  open,
  onOpenChange,
  reference,
  submit,
  onReload,
  onDone,
}: Props) {
  const ids = useId();
  const formId = `${ids}-form`;
  const fieldIds: Record<CloseField, string> = { reason: `${ids}-reason`, note: `${ids}-note` };
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<CloseDraft>({ reason: null, note: "" });
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<EnquiryWriteFailure | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft({ reason: null, note: "" });
    setAttempted(false);
    setFailure(null);
  }, [open]);

  const errors = attempted ? validateClose(draft) : {};
  const summary = (Object.keys(errors) as CloseField[]).flatMap((field) =>
    errors[field] ? [{ fieldId: fieldIds[field], message: errors[field] as string }] : [],
  );

  async function proceed() {
    setAttempted(true);
    if (!draft.reason || Object.keys(validateClose(draft)).length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    const reason = draft.reason;
    const note = draft.note.trim();
    setFailure(null);
    setBusy(true);
    const result = await submit({
      status: "closed",
      closeReason: reason,
      ...(note ? { note } : {}),
    });
    setBusy(false);
    if (result.ok) {
      onOpenChange(false);
      onDone(reason);
    } else {
      setFailure(failureOf(result));
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
      title={`Close ${reference}`}
      description="The reason is kept with the enquiry. You can reopen it later."
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
          <StaffButton type="submit" form={formId} variant="primary" loading={busy}>
            Close enquiry
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={`Close ${reference}`}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void proceed();
        }}
      >
        <FormErrorSummary errors={summary} focusKey={failedSubmits} />
        {failure ? (
          <EnquiryWriteFailureNotice
            failure={failure}
            title="The enquiry couldn't be closed"
            onReload={onReload}
          />
        ) : null}
        <ChoiceFieldset legend="Reason" id={fieldIds.reason} error={errors.reason} disabled={busy}>
          <StaffRadioGroup
            value={draft.reason ?? ""}
            disabled={busy}
            onValueChange={(next) =>
              setDraft((current) => ({ ...current, reason: next as EnquiryCloseReason }))
            }
          >
            {ENQUIRY_CLOSE_REASONS_IN_ORDER.map((reason) => (
              <ChoiceRow
                key={reason}
                htmlFor={`${ids}-reason-${reason}`}
                label={ENQUIRY_CLOSE_REASON_LABELS[reason]}
                description={ENQUIRY_CLOSE_REASON_HINTS[reason]}
                disabled={busy}
                control={
                  <StaffRadio id={`${ids}-reason-${reason}`} value={reason} disabled={busy} />
                }
              />
            ))}
          </StaffRadioGroup>
        </ChoiceFieldset>
        <Field
          label="Note"
          id={fieldIds.note}
          description="Internal. Don't paste the client's personal details."
          error={errors.note}
          optional
          disabled={busy}
        >
          <TextArea
            rows={3}
            value={draft.note}
            maxLength={5000}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
