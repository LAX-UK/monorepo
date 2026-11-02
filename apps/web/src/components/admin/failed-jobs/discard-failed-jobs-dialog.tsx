"use client";

import { jobCount } from "@/lib/admin/failed-jobs/failed-job-outcome";
import {
  ChoiceFieldset,
  ChoiceRow,
  Field,
  Notice,
  StaffButton,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
} from "@auction/staff-ui";
import {
  FAILED_JOB_DISCARD_REASONS,
  FAILED_JOB_DISCARD_REASON_OPTIONS,
  FAILED_JOB_NOTE_MAX,
  type FailedJobDiscardReason,
  isFailedJobDiscardReason,
} from "@auction/types";
import { useId, useRef, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: readonly { id: string }[];
  busy: boolean;
  failure: { message: string; details: string[] } | null;
  onConfirm: (details: { ids: string[]; reason: FailedJobDiscardReason; note: string }) => void;
};

/**
 * Sets failed jobs aside with one reason from a short list. "Other" needs a note; any other
 * reason may carry one. Nothing is deleted: discarded jobs stay in the Discarded view and can be
 * restored, so the dialog says so rather than warning.
 */
export function DiscardFailedJobsDialog({
  open,
  onOpenChange,
  jobs,
  busy,
  failure,
  onConfirm,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const groupId = useId();
  const noteId = useId();
  const [reason, setReason] = useState<FailedJobDiscardReason | "">("");
  const [note, setNote] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  const count = jobs.length;

  const confirm = () => {
    if (!reason) {
      setReasonError("Choose a reason.");
      return;
    }
    if (reason === "other" && note.trim().length === 0) {
      setNoteError("Add a note when the reason is other.");
      return;
    }
    onConfirm({ ids: jobs.map((job) => job.id), reason, note: note.trim() });
  };

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    if (!next) {
      setReason("");
      setNote("");
      setReasonError(null);
      setNoteError(null);
    }
    onOpenChange(next);
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={handleOpenChange}
      initialFocusRef={cancelRef}
      size="md"
      title={`Discard ${jobCount(count)}?`}
      description={
        count === 1
          ? "It moves to Discarded. Nothing is deleted, and you can restore it from there."
          : "They move to Discarded. Nothing is deleted, and you can restore them from there."
      }
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton variant="primary" loading={busy} onClick={confirm}>
            {`Discard ${jobCount(count)}`}
          </StaffButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ChoiceFieldset legend="Reason" id={groupId} error={reasonError} disabled={busy}>
          <StaffRadioGroup
            aria-label="Reason"
            value={reason}
            onValueChange={(next) => {
              if (!isFailedJobDiscardReason(next)) return;
              setReason(next);
              setReasonError(null);
              if (next !== "other") setNoteError(null);
            }}
          >
            {FAILED_JOB_DISCARD_REASONS.map((code) => {
              const option = FAILED_JOB_DISCARD_REASON_OPTIONS[code];
              const id = `${groupId}-${code}`;
              return (
                <ChoiceRow
                  key={code}
                  htmlFor={id}
                  label={option.label}
                  {...("hint" in option && option.hint ? { description: option.hint } : {})}
                  control={<StaffRadio id={id} value={code} />}
                />
              );
            })}
          </StaffRadioGroup>
        </ChoiceFieldset>
        <Field
          id={noteId}
          label="Note"
          optional={reason !== "other"}
          description="Kept in the audit log with your name."
          error={noteError}
          disabled={busy}
        >
          <TextArea
            id={noteId}
            value={note}
            maxLength={FAILED_JOB_NOTE_MAX}
            placeholder="For example, client services asked the client for a new address."
            onChange={(event) => {
              setNote(event.target.value);
              if (noteError && event.target.value.trim()) setNoteError(null);
            }}
          />
        </Field>
        {failure ? (
          <Notice tone="danger" alert title={failure.message}>
            {failure.details.length > 0 ? (
              <ul className="list-disc pl-4">
                {failure.details.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </Notice>
        ) : null}
      </div>
    </StaffDialog>
  );
}
