"use client";

import { useSettledValue } from "@/hooks/use-settled-value";
import {
  editStorageTermsAction,
  scheduleStorageTermsAction,
} from "@/lib/actions/admin/admin-collection-storage";
import { STORAGE_COPY } from "@/lib/admin/collections/storage-copy";
import {
  STORAGE_FIELDS,
  type StorageDraft,
  type StorageErrors,
  type StorageField,
  bodyFromDraft,
  buyerPreview,
  draftFromTerms,
  isStorageDraftDirty,
  latestStartDay,
  validateStorageDraft,
} from "@/lib/admin/collections/storage.vm";
import { latestStorageTermsStart } from "@auction/domain";
import {
  ChoiceFieldset,
  ChoiceRow,
  DateInput,
  DetailPanel,
  Field,
  FormErrorSummary,
  FormSection,
  MoneyInput,
  Notice,
  StaffButton,
  StaffCheckbox,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
  TextInput,
  UnsavedChangesGuard,
  confirmDiscardChanges,
  shiftDay,
} from "@auction/staff-ui";
import type { StaffStorageSettings, StaffStorageTerms } from "@auction/types";
import { useId, useMemo, useState } from "react";
import { type StorageFailure, useStorageChange } from "./use-storage-change";

const C = STORAGE_COPY.sheet;

/** How long typing must pause before a screen reader hears the new "Buyers will read". */
const PREVIEW_SETTLE_MS = 800;

type Props = {
  /** Closes the sheet; the parent mounts it again (fresh) for the next change. */
  onClose: () => void;
  venueId: string;
  /** The London day; a change starts from the day after. */
  today: string;
  inForce: StaffStorageTerms | null;
  /** The scheduled change being edited; `null` to schedule a new one. */
  editing: StaffStorageTerms | null;
  onSaved: (settings: StaffStorageSettings) => void;
};

/**
 * Schedule a change (or edit the scheduled one) in a side sheet: when it starts and why, the free
 * period, the daily charge and the handling fee, with "Buyers will read" built by the buyer
 * formatter as staff type. Errors show on submit: inline under each field, and with two or more a
 * summary at the top that links to each. The buttons stay in view in the sheet's footer; the
 * submit shows it is saving and cannot be pressed twice. Closing with changes asks first. Mount it
 * only while open, so each change starts from the terms as they are now.
 */
export function StorageTermsSheet({ onClose, venueId, today, inForce, editing, onSaved }: Props) {
  const ids = useId();
  const formId = `${ids}-form`;
  const fieldId = (name: StorageField) => `${ids}-${name}`;
  const initial = useMemo(
    () => (editing ? draftFromTerms(editing, editing) : draftFromTerms(inForce)),
    [editing, inForce],
  );
  const [draft, setDraft] = useState<StorageDraft>(initial);
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [failure, setFailure] = useState<StorageFailure | null>(null);
  const change = useStorageChange();

  const dirty = isStorageDraftDirty(draft, initial);
  const clientErrors = useMemo(() => validateStorageDraft(draft, today), [draft, today]);
  const errors: StorageErrors = attempted ? { ...clientErrors } : {};
  // The API re-checks the start date against the London day; say it in the form's words.
  const startIssue = failure?.issues.find((issue) => issue.field === "effectiveFrom");
  if (startIssue && !errors.effectiveFrom) {
    errors.effectiveFrom =
      failure?.code === "start_too_late"
        ? STORAGE_COPY.errors.startsTooLate(latestStartDay(today))
        : failure?.code === "start_not_in_future"
          ? STORAGE_COPY.errors.startsOn
          : startIssue.message;
  }
  const summary = STORAGE_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: fieldId(field), message }] : [];
  });
  const preview = buyerPreview(draft) ?? C.previewPending;
  // Shown at once, spoken once typing pauses: not the whole sentence on every keystroke.
  const spokenPreview = useSettledValue(preview, PREVIEW_SETTLE_MS);
  const locked = change.busy;

  const set = <K extends keyof StorageDraft>(key: K, value: StorageDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === "effectiveFrom") setFailure(null);
  };

  async function submit() {
    if (change.busy) return;
    setAttempted(true);
    const found = STORAGE_FIELDS.filter((field) => clientErrors[field]);
    if (found.length > 0) {
      setFailedSubmits((count) => count + 1);
      // One problem: go straight to its field. Two or more: the summary takes focus.
      if (found.length === 1) document.getElementById(fieldId(found[0] as StorageField))?.focus();
      return;
    }
    const body = bodyFromDraft(draft);
    const outcome = await change.run(() =>
      editing
        ? editStorageTermsAction(venueId, editing.id, body)
        : scheduleStorageTermsAction(venueId, body),
    );
    if (outcome.ok) {
      onSaved(outcome.settings);
      return;
    }
    setFailure(outcome.failure);
  }

  async function cancel() {
    if (!dirty || (await confirmDiscardChanges())) onClose();
  }

  return (
    <DetailPanel
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={editing ? C.titleEdit : C.titleNew}
      description={C.description}
      size="lg"
      dirty={dirty && !change.busy}
      dirtyLabel={C.dirtyLabel}
      footer={
        <>
          <StaffButton
            type="button"
            variant="secondary"
            disabled={locked}
            onClick={() => void cancel()}
          >
            {C.cancel}
          </StaffButton>
          <StaffButton type="submit" form={formId} variant="primary" loading={change.busy}>
            {editing ? C.submitEdit : C.submitNew}
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={editing ? C.titleEdit : C.titleNew}
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <UnsavedChangesGuard dirty={dirty} label={C.dirtyLabel} />
        {summary.length >= 2 ? (
          <FormErrorSummary
            errors={summary}
            title={C.summaryTitle(summary.length)}
            focusKey={failedSubmits}
          />
        ) : null}
        {failure && failure.issues.length === 0 ? (
          <Notice tone="danger" alert title={STORAGE_COPY.failed}>
            {failure.message}
          </Notice>
        ) : null}

        <FormSection title={C.sections.when}>
          <Field
            id={fieldId("effectiveFrom")}
            label={STORAGE_COPY.labels.startsOn}
            description={C.startsOnHint(latestStartDay(today))}
            error={errors.effectiveFrom}
            disabled={locked}
          >
            <DateInput
              value={draft.effectiveFrom}
              min={shiftDay(today, 1)}
              max={latestStorageTermsStart(today)}
              onValueChange={(day) => set("effectiveFrom", day)}
            />
          </Field>
          <Field
            id={fieldId("reason")}
            label={C.reasonLabel}
            description={C.reasonHint}
            error={errors.reason}
            disabled={locked}
          >
            <TextArea
              rows={2}
              maxLength={500}
              value={draft.reason}
              onChange={(event) => set("reason", event.target.value)}
            />
          </Field>
        </FormSection>

        <FormSection title={C.sections.free}>
          <Field
            id={fieldId("freeDays")}
            label={C.freeDaysLabel}
            description={C.freeDaysHint}
            error={errors.freeDays}
            disabled={locked}
          >
            <TextInput
              inputMode="numeric"
              autoComplete="off"
              className="tabular-nums"
              value={draft.freeDays}
              onChange={(event) => set("freeDays", event.target.value)}
            />
          </Field>
          <ChoiceFieldset legend={C.countLabel} disabled={locked}>
            <StaffRadioGroup
              value={draft.countMode}
              onValueChange={(value) =>
                set("countMode", value === "working" ? "working" : "calendar")
              }
            >
              <ChoiceRow
                htmlFor={`${ids}-calendar`}
                label={`${C.calendar} (${C.recommended})`}
                control={<StaffRadio id={`${ids}-calendar`} value="calendar" />}
              />
              <ChoiceRow
                htmlFor={`${ids}-working`}
                label={C.working}
                description={C.workingHint}
                control={<StaffRadio id={`${ids}-working`} value="working" />}
              />
            </StaffRadioGroup>
          </ChoiceFieldset>
        </FormSection>

        <FormSection title={C.sections.daily}>
          <Field
            id={fieldId("standard")}
            label={C.standardLabel}
            description={C.dailyHint}
            error={errors.standard}
            disabled={locked}
          >
            <MoneyInput
              value={draft.standard.pence}
              onValueChange={(pence, parsed) =>
                set("standard", { pence, empty: !parsed.ok && parsed.reason === "empty" })
              }
            />
          </Field>
          <ChoiceRow
            htmlFor={`${ids}-large-on`}
            label={C.largeToggle}
            description={C.largeToggleHint}
            disabled={locked}
            control={
              <StaffCheckbox
                id={`${ids}-large-on`}
                checked={draft.largeOn}
                disabled={locked}
                onCheckedChange={(checked) => set("largeOn", checked === true)}
              />
            }
          />
          {draft.largeOn ? (
            <Field
              id={fieldId("large")}
              label={C.largeLabel}
              description={C.dailyHint}
              error={errors.large}
              disabled={locked}
            >
              <MoneyInput
                value={draft.large.pence}
                onValueChange={(pence, parsed) =>
                  set("large", { pence, empty: !parsed.ok && parsed.reason === "empty" })
                }
              />
            </Field>
          ) : null}
        </FormSection>

        <FormSection title={C.sections.handling}>
          <Field
            id={fieldId("handling")}
            label={C.handlingLabel}
            description={C.handlingHint}
            error={errors.handling}
            optional
            disabled={locked}
          >
            <MoneyInput
              value={draft.handling.pence}
              onValueChange={(pence, parsed) =>
                set("handling", { pence, empty: !parsed.ok && parsed.reason === "empty" })
              }
            />
          </Field>
        </FormSection>

        <Notice tone="info" title={C.previewTitle} quiet>
          {preview}
        </Notice>
        <output className="sr-only" data-testid="storage-preview-announcer">
          {`${C.previewTitle}: ${spokenPreview}`}
        </output>
      </form>
    </DetailPanel>
  );
}
