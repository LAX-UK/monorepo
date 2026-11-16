"use client";

import { extendLotStorageAction } from "@/lib/actions/admin/admin-collection-overdue";
import { NOT_COLLECTED_COPY } from "@/lib/admin/collections/not-collected-copy";
import {
  EXTEND_FIELDS,
  type ExtendDraft,
  type ExtendErrors,
  type ExtendField,
  parseExtensionDays,
  validateExtendDraft,
} from "@/lib/admin/collections/not-collected.vm";
import {
  Field,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffDialog,
  TextArea,
  TextInput,
  UnsavedChangesGuard,
  confirmDiscardChanges,
} from "@auction/staff-ui";
import type { StaffOverdueLots } from "@auction/types";
import { useId, useMemo, useState } from "react";
import { type OverdueFailure, useOverdueChange } from "./use-overdue-change";

const C = NOT_COLLECTED_COPY.extend;
const EMPTY: ExtendDraft = { days: "", reason: "" };

type Props = {
  venueId: string;
  lotId: string;
  /** "Lot 12 · Lowland Storm". */
  lotLine: string;
  /** Free days the lot may still be given. */
  maxDays: number;
  onClose: () => void;
  onSaved: (lots: StaffOverdueLots) => void;
};

/**
 * Extend free storage on one lot: how many days (up to what is left of the 30) and why. Two fields,
 * so a failed submit shows the error summary at the top as well as each inline error. Mount it only
 * while open, so each extension starts empty.
 */
export function ExtendStorageDialog({ venueId, lotId, lotLine, maxDays, onClose, onSaved }: Props) {
  const ids = useId();
  const formId = `${ids}-form`;
  const fieldId = (name: ExtendField) => `${ids}-${name}`;
  const [draft, setDraft] = useState<ExtendDraft>(EMPTY);
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [failure, setFailure] = useState<OverdueFailure | null>(null);
  const change = useOverdueChange();

  const dirty = draft.days !== "" || draft.reason !== "";
  const clientErrors = useMemo(() => validateExtendDraft(draft, maxDays), [draft, maxDays]);
  const errors: ExtendErrors = attempted ? { ...clientErrors } : {};
  const daysIssue = failure?.issues.find((issue) => issue.field === "days");
  if (daysIssue && !errors.days) errors.days = daysIssue.message;
  const summary = EXTEND_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: fieldId(field), message }] : [];
  });
  const days = parseExtensionDays(draft.days, maxDays);

  const set = (key: ExtendField, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === "days") setFailure(null);
  };

  async function submit() {
    if (change.busy) return;
    setAttempted(true);
    const found = EXTEND_FIELDS.filter((field) => clientErrors[field]);
    if (found.length > 0 || days === null) {
      setFailedSubmits((count) => count + 1);
      // One problem: go straight to its field. Two: the summary takes focus.
      if (found.length === 1) document.getElementById(fieldId(found[0] as ExtendField))?.focus();
      return;
    }
    const outcome = await change.run(() =>
      extendLotStorageAction(venueId, lotId, { days, reason: draft.reason.trim() }),
    );
    if (outcome.ok) {
      onSaved(outcome.lots);
      return;
    }
    setFailure(outcome.failure);
    if (outcome.failure?.issues.some((issue) => issue.field === "days")) {
      document.getElementById(fieldId("days"))?.focus();
    }
  }

  async function close() {
    if (change.busy) return;
    if (!dirty || (await confirmDiscardChanges())) onClose();
  }

  return (
    <StaffDialog
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
      size="md"
      title={C.title}
      description={C.description(lotLine)}
      footer={
        <>
          <StaffButton
            type="button"
            variant="secondary"
            disabled={change.busy}
            onClick={() => void close()}
          >
            {C.cancel}
          </StaffButton>
          <StaffButton type="submit" form={formId} variant="primary" loading={change.busy}>
            {C.submit}
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={C.title}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <UnsavedChangesGuard dirty={dirty && !change.busy} label={C.dirtyLabel} />
        {summary.length >= 2 ? (
          <FormErrorSummary
            errors={summary}
            title={NOT_COLLECTED_COPY.summaryTitle(summary.length)}
            focusKey={failedSubmits}
          />
        ) : null}
        {failure && failure.issues.length === 0 ? (
          <Notice tone="danger" alert title={NOT_COLLECTED_COPY.failed}>
            {failure.message}
          </Notice>
        ) : null}
        <Field
          id={fieldId("days")}
          label={C.daysLabel}
          description={C.daysHint(maxDays)}
          error={errors.days}
          disabled={change.busy}
        >
          <TextInput
            inputMode="numeric"
            autoComplete="off"
            className="tabular-nums"
            boxClassName="max-w-staff-field-count"
            value={draft.days}
            onChange={(event) => set("days", event.target.value)}
          />
        </Field>
        <Field
          id={fieldId("reason")}
          label={C.reasonLabel}
          description={C.reasonHint}
          error={errors.reason}
          disabled={change.busy}
        >
          <TextArea
            rows={3}
            maxLength={500}
            value={draft.reason}
            onChange={(event) => set("reason", event.target.value)}
          />
        </Field>
        {days !== null ? (
          <Notice tone="info" quiet title={C.effect(days)}>
            {null}
          </Notice>
        ) : null}
      </form>
    </StaffDialog>
  );
}
