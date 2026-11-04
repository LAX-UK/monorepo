"use client";

import { outcomeState } from "@/lib/admin/data-requests/data-request-actions";
import {
  CLOSE_NOTE_FIELD,
  type CloseDraft,
  type CloseField,
  validateClose,
} from "@/lib/admin/data-requests/data-request-forms";
import { ALL_OUTCOMES, OUTCOME_LABELS } from "@/lib/admin/data-requests/data-requests.vm";
import type {
  DataRequestOutcome,
  ManualRequestView,
} from "@auction/identity-contracts/data-requests";
import {
  ChoiceFieldset,
  ChoiceRow,
  Field,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffCheckbox,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
} from "@auction/staff-ui";
import { Check } from "@auction/staff-ui/icons";
import { useId, useRef, useState } from "react";
import { DataRequestWriteFailure } from "./data-request-write-failure";
import type { WriteFailure, WriteResult } from "./use-data-request-writes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: Pick<ManualRequestView, "reference" | "status" | "due">;
  submit: (body: Record<string, unknown>) => Promise<WriteResult>;
  onReload: () => void;
  onDone: (outcome: DataRequestOutcome) => void;
};

/**
 * Closes a request with the outcome the law allows. A refusal needs its reason and confirmation
 * that the person was told they may complain to the ICO; a partial copy names the exemption. A
 * request already past its due date says it will be recorded as late. The button is the confirm.
 */
export function CloseDataRequestDialog({
  open,
  onOpenChange,
  request,
  submit,
  onReload,
  onDone,
}: Props) {
  const ids = useId();
  const formId = `${ids}-form`;
  const fieldIds: Record<CloseField, string> = {
    outcome: `${ids}-outcome`,
    note: `${ids}-note`,
    complaintRightTold: `${ids}-complaint`,
  };
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<CloseDraft>({
    outcome: null,
    note: "",
    complaintRightTold: false,
  });
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<WriteFailure | null>(null);

  const errors = attempted ? validateClose(draft) : {};
  const summary = (Object.keys(errors) as CloseField[]).flatMap((field) =>
    errors[field] ? [{ fieldId: fieldIds[field], message: errors[field] as string }] : [],
  );
  const noteRule = draft.outcome ? CLOSE_NOTE_FIELD[draft.outcome] : null;
  const lateDays = request.due.state === "overdue" ? Math.abs(request.due.daysLeft ?? 0) : 0;
  const refused = draft.outcome === "refused";

  async function proceed() {
    setAttempted(true);
    if (!draft.outcome || Object.keys(validateClose(draft)).length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    const outcome = draft.outcome;
    setFailure(null);
    setBusy(true);
    const note = draft.note.trim();
    const result = await submit({
      outcome,
      ...(note ? { note } : {}),
      ...(outcome === "refused" ? { complaintRightTold: true } : {}),
    });
    setBusy(false);
    if (result.ok) {
      onOpenChange(false);
      onDone(outcome);
    } else {
      setFailure({ message: result.error, stale: result.errorCode === "stale_version" });
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
      title={
        refused
          ? `Close ${request.reference} as refused`
          : `Close ${request.reference} with an outcome`
      }
      description={
        refused
          ? "Refusing is rare. The person must be told why, and that they can complain to the ICO."
          : "The outcome and date are recorded, with whether it was on time."
      }
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
            variant="primary"
            loading={busy}
            icon={<Check aria-hidden />}
          >
            {refused ? "Close as refused" : "Close request"}
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={`Close ${request.reference}`}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void proceed();
        }}
      >
        <FormErrorSummary errors={summary} focusKey={failedSubmits} />
        {failure ? (
          <DataRequestWriteFailure
            failure={failure}
            title="The request couldn't be closed"
            onReload={onReload}
          />
        ) : null}
        <ChoiceFieldset
          legend="Outcome"
          id={fieldIds.outcome}
          error={errors.outcome}
          disabled={busy}
        >
          <StaffRadioGroup
            value={draft.outcome ?? ""}
            disabled={busy}
            onValueChange={(next) =>
              setDraft((current) => ({
                ...current,
                outcome: next as DataRequestOutcome,
                complaintRightTold: false,
              }))
            }
          >
            {ALL_OUTCOMES.map((outcome) => {
              const state = outcomeState(outcome, request);
              const blocked = state.kind === "disabled";
              return (
                <ChoiceRow
                  key={outcome}
                  htmlFor={`${ids}-outcome-${outcome}`}
                  label={OUTCOME_LABELS[outcome]}
                  disabled={busy || blocked}
                  {...(blocked ? { description: state.reason } : {})}
                  control={
                    <StaffRadio
                      id={`${ids}-outcome-${outcome}`}
                      value={outcome}
                      disabled={busy || blocked}
                    />
                  }
                />
              );
            })}
          </StaffRadioGroup>
        </ChoiceFieldset>
        {noteRule ? (
          <Field
            label={noteRule.label}
            id={fieldIds.note}
            description={noteRule.hint}
            error={errors.note}
            optional={!noteRule.required}
            disabled={busy}
          >
            <TextArea
              rows={3}
              value={draft.note}
              maxLength={2000}
              onChange={(event) =>
                setDraft((current) => ({ ...current, note: event.target.value }))
              }
            />
          </Field>
        ) : null}
        {refused ? (
          <ChoiceFieldset
            legend="Right to complain"
            id={fieldIds.complaintRightTold}
            error={errors.complaintRightTold}
            disabled={busy}
          >
            <ChoiceRow
              htmlFor={`${ids}-complaint-box`}
              label="The person has been told why, and that they can complain to the ICO or go to court."
              disabled={busy}
              control={
                <StaffCheckbox
                  id={`${ids}-complaint-box`}
                  checked={draft.complaintRightTold}
                  disabled={busy}
                  onCheckedChange={(next) =>
                    setDraft((current) => ({ ...current, complaintRightTold: next === true }))
                  }
                />
              }
            />
          </ChoiceFieldset>
        ) : null}
        {lateDays > 0 ? (
          <Notice
            tone="warning"
            title={`This will be recorded as ${lateDays} ${lateDays === 1 ? "day" : "days"} late`}
          >
            Say why in the note, for the record.
          </Notice>
        ) : null}
      </form>
    </StaffDialog>
  );
}
