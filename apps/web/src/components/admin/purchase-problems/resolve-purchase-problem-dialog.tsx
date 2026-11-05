"use client";

import { validateResolution } from "@/lib/admin/purchase-problems/purchase-problem-forms";
import { PURCHASE_PROBLEM_NOTE_MAX } from "@auction/domain";
import { Field, StaffButton, StaffDialog, TextArea } from "@auction/staff-ui";
import { useEffect, useId, useRef, useState } from "react";
import {
  type PurchaseProblemWriteFailure,
  PurchaseProblemWriteFailureNotice,
} from "./purchase-problem-write-failure";
import { type PurchaseProblemWrites, failureOf } from "./use-purchase-problem-writes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
  submit: PurchaseProblemWrites["patch"];
  onReload: () => void;
  onDone: () => void;
};

/**
 * Resolves a report. The note says what was done and is kept with the report, so it cannot be
 * left empty: whoever opens the report later can see how it ended.
 */
export function ResolvePurchaseProblemDialog({
  open,
  onOpenChange,
  reference,
  submit,
  onReload,
  onDone,
}: Props) {
  const ids = useId();
  const formId = `${ids}-form`;
  const noteId = `${ids}-note`;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [note, setNote] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<PurchaseProblemWriteFailure | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setAttempted(false);
    setFailure(null);
  }, [open]);

  const error = attempted ? validateResolution(note) : null;

  async function proceed() {
    setAttempted(true);
    if (validateResolution(note)) return;
    setFailure(null);
    setBusy(true);
    const result = await submit({ status: "resolved", note: note.trim() });
    setBusy(false);
    if (result.ok) {
      onOpenChange(false);
      onDone();
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
      title={`Resolve ${reference}`}
      description="The report moves to Resolved and the buyer no longer sees it as open."
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
            Resolve report
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={`Resolve ${reference}`}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void proceed();
        }}
      >
        {failure ? (
          <PurchaseProblemWriteFailureNotice
            failure={failure}
            title="The report couldn't be resolved"
            onReload={onReload}
          />
        ) : null}
        <Field
          label="What was done"
          id={noteId}
          description="Internal. For example: refund issued, replacement sent, or what you told the buyer."
          error={error ?? undefined}
          disabled={busy}
        >
          <TextArea
            rows={4}
            value={note}
            maxLength={PURCHASE_PROBLEM_NOTE_MAX}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
