"use client";

import {
  type ExtendDraft,
  type ExtendField,
  extensionChoices,
  validateExtend,
} from "@/lib/admin/data-requests/data-request-forms";
import {
  EXTENSION_NOTE_LABELS,
  EXTENSION_REASON_LABELS,
  TOLD_VIA_LABELS,
  formatDay,
} from "@/lib/admin/data-requests/data-requests.vm";
import {
  DATA_REQUEST_EXTENSION_REASONS,
  DATA_REQUEST_TOLD_VIA,
  type DataRequestExtensionMonths,
} from "@auction/identity-contracts/data-requests";
import {
  ChoiceFieldset,
  ChoiceRow,
  DateInput,
  EnumSelect,
  Field,
  FormErrorSummary,
  StaffButton,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
} from "@auction/staff-ui";
import { CalendarPlus, Clock } from "@auction/staff-ui/icons";
import { useId, useRef, useState } from "react";
import { DataRequestWriteFailure } from "./data-request-write-failure";
import type { WriteFailure, WriteResult } from "./use-data-request-writes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
  /** The due date before any extension. */
  originalDueOn: string;
  today: string;
  submit: (body: Record<string, unknown>) => Promise<WriteResult>;
  onReload: () => void;
  onDone: (newDueOn: string) => void;
};

const MONTHS: readonly DataRequestExtensionMonths[] = [1, 2];

const REASON_OPTIONS = DATA_REQUEST_EXTENSION_REASONS.map((value) => ({
  value,
  label: EXTENSION_REASON_LABELS[value],
}));
const VIA_OPTIONS = DATA_REQUEST_TOLD_VIA.map((value) => ({
  value,
  label: TOLD_VIA_LABELS[value],
}));

/**
 * Article 12(3): one or two more months for a complex request, recorded before the original due
 * date along with when and how the person was told. It states the new due date before anything
 * happens, and the button repeats it. The system sends nothing: staff tell the person themselves.
 */
export function ExtendDataRequestDialog({
  open,
  onOpenChange,
  reference,
  originalDueOn,
  today,
  submit,
  onReload,
  onDone,
}: Props) {
  const ids = useId();
  const formId = `${ids}-form`;
  const fieldIds: Record<ExtendField, string> = {
    note: `${ids}-note`,
    personToldOn: `${ids}-told-on`,
    personToldVia: `${ids}-told-via`,
  };
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<ExtendDraft>({
    months: 2,
    reason: "complex",
    note: "",
    personToldOn: today <= originalDueOn ? today : originalDueOn,
    personToldVia: null,
  });
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<WriteFailure | null>(null);

  const errors = attempted ? validateExtend(draft, { originalDueOn, today }) : {};
  const summary = (Object.keys(errors) as ExtendField[]).flatMap((field) =>
    errors[field] ? [{ fieldId: fieldIds[field], message: errors[field] as string }] : [],
  );
  const dates = extensionChoices(originalDueOn);
  const newDue = dates[draft.months];
  const set = <K extends keyof ExtendDraft>(key: K, value: ExtendDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function proceed() {
    setAttempted(true);
    if (Object.keys(validateExtend(draft, { originalDueOn, today })).length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setFailure(null);
    setBusy(true);
    const result = await submit({
      months: draft.months,
      reason: draft.reason,
      note: draft.note.trim(),
      personToldOn: draft.personToldOn,
      personToldVia: draft.personToldVia,
    });
    setBusy(false);
    if (result.ok) {
      onOpenChange(false);
      onDone(newDue);
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
      title={`Extend ${reference}?`}
      description="Only for a complex request, or when the person has made several. You can extend once, before the original due date."
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
            icon={<CalendarPlus aria-hidden />}
          >
            {`Extend to ${formatDay(newDue)}`}
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={`Extend ${reference}`}
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
            title="The request couldn't be extended"
            onReload={onReload}
          />
        ) : null}
        <ChoiceFieldset legend="Extend by" disabled={busy}>
          <StaffRadioGroup
            value={String(draft.months)}
            disabled={busy}
            onValueChange={(next) => set("months", next === "1" ? 1 : 2)}
          >
            {MONTHS.map((months) => (
              <ChoiceRow
                key={months}
                htmlFor={`${ids}-months-${months}`}
                label={months === 1 ? "1 month" : "2 months"}
                description={`New due date ${formatDay(dates[months])}${months === 2 ? ", the most the law allows" : ""}`}
                disabled={busy}
                control={<StaffRadio id={`${ids}-months-${months}`} value={String(months)} />}
              />
            ))}
          </StaffRadioGroup>
        </ChoiceFieldset>
        <Field label="Reason" disabled={busy}>
          <EnumSelect
            value={draft.reason}
            options={REASON_OPTIONS}
            disabled={busy}
            onValueChange={(next) => set("reason", next)}
          />
        </Field>
        <Field
          label={EXTENSION_NOTE_LABELS[draft.reason]}
          id={fieldIds.note}
          error={errors.note}
          disabled={busy}
        >
          <TextArea
            rows={3}
            value={draft.note}
            maxLength={2000}
            onChange={(event) => set("note", event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Person told on"
            id={fieldIds.personToldOn}
            description={`On or before ${formatDay(originalDueOn)}`}
            error={errors.personToldOn}
            disabled={busy}
          >
            <DateInput
              value={draft.personToldOn}
              max={today < originalDueOn ? today : originalDueOn}
              onValueChange={(day) => set("personToldOn", day)}
            />
          </Field>
          <Field
            label="How"
            id={fieldIds.personToldVia}
            error={errors.personToldVia}
            disabled={busy}
          >
            <EnumSelect
              value={draft.personToldVia}
              options={VIA_OPTIONS}
              placeholder="Choose how"
              disabled={busy}
              onValueChange={(next) => set("personToldVia", next)}
            />
          </Field>
        </div>
        <p className="flex items-center gap-2 rounded-staff-md bg-staff-sunken px-3 py-2 text-staff-sm text-staff-fg">
          <Clock aria-hidden className="size-4 shrink-0 text-staff-muted" />
          <span>
            Due moves from {formatDay(originalDueOn)} to{" "}
            <b className="font-semibold">{formatDay(newDue)}</b>
          </span>
        </p>
      </form>
    </StaffDialog>
  );
}
