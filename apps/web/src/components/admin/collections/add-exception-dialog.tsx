"use client";

import { addCollectionExceptionAction } from "@/lib/actions/admin/admin-collections";
import {
  type ExceptionDraft,
  exceptionBody,
  validateExceptionDraft,
} from "@/lib/admin/collections/collection-forms";
import { EXCEPTION_ISSUE_MESSAGES } from "@/lib/admin/collections/collections.vm";
import { notify } from "@/lib/ui/notify";
import type { ExceptionIssueCode } from "@auction/domain";
import {
  ChoiceRow,
  DateInput,
  Field,
  FieldRow,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffDialog,
  StaffSwitch,
  TextArea,
  TextInput,
} from "@auction/staff-ui";
import type { AffectedBookingsChoice } from "@auction/validators";
import { useCallback, useId, useRef, useState } from "react";
import { AffectedBookingsDialog } from "./affected-bookings-dialog";
import { useCollectionChange } from "./use-collection-change";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: string;
  today: string;
  /** What the form starts with: its kind is fixed by the button that opened it. */
  initial: ExceptionDraft;
};

const ISSUE_FIELD: Record<ExceptionIssueCode, "start" | "end" | "opens" | "closes"> = {
  date_invalid: "start",
  ends_before_start: "end",
  too_long: "end",
  time_invalid: "opens",
  hours_incomplete: "opens",
  closes_not_after_opens: "closes",
};

/**
 * Adds a closure (the gallery is shut) or an extra opening (open when the weekly hours say
 * closed, or on a sale day) for a day, a run of days, or part of a day. If visits are already
 * booked in what it closes, they are listed first and staff choose what happens to them.
 */
export function AddExceptionDialog({ open, onOpenChange, venueId, today, initial }: Props) {
  const ids = useId();
  const formId = `${ids}-form`;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<ExceptionDraft>(initial);
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);

  const issues = validateExceptionDraft(draft, today);
  const shown = attempted ? issues : [];
  const messageFor = (field: "start" | "end" | "opens" | "closes") => {
    const issue = shown.find((code) => ISSUE_FIELD[code] === field);
    return issue ? EXCEPTION_ISSUE_MESSAGES[issue] : undefined;
  };
  const fieldId = (field: string) => `${ids}-${field}`;
  const summary = shown.map((code) => ({
    fieldId: fieldId(ISSUE_FIELD[code]),
    message: EXCEPTION_ISSUE_MESSAGES[code],
  }));

  const send = useCallback(
    (choice: AffectedBookingsChoice | undefined) =>
      addCollectionExceptionAction(venueId, {
        ...exceptionBody(draft),
        ...(choice ? { affectedBookings: choice } : {}),
      }),
    [venueId, draft],
  );
  const change = useCollectionChange(send, (result) => {
    onOpenChange(false);
    setDraft(initial);
    setAttempted(false);
    notify.success(
      result.cancelled > 0
        ? `Added. ${result.cancelled} ${result.cancelled === 1 ? "visit" : "visits"} cancelled.`
        : draft.kind === "closure"
          ? "Closure added."
          : "Extra opening added.",
    );
  });

  const set = <K extends keyof ExceptionDraft>(key: K, value: ExceptionDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function submit() {
    setAttempted(true);
    if (issues.length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    void change.submit();
  }

  const isClosure = draft.kind === "closure";
  return (
    <>
      <StaffDialog
        open={open && change.affected === null}
        onOpenChange={(next) => {
          if (!change.busy) onOpenChange(next);
        }}
        size="md"
        initialFocusRef={cancelRef}
        title={isClosure ? "Add closure" : "Add extra opening"}
        description={
          isClosure
            ? "Clients can't book visits on these days or times."
            : "Clients can book visits on these days or times, even if the weekly hours say closed."
        }
        footer={
          <>
            <StaffButton
              ref={cancelRef}
              variant="secondary"
              disabled={change.busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </StaffButton>
            <StaffButton type="submit" form={formId} variant="primary" loading={change.busy}>
              {isClosure ? "Add closure" : "Add extra opening"}
            </StaffButton>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          aria-label="Add a closure or extra opening"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormErrorSummary errors={summary} focusKey={failedSubmits} />
          {change.failure ? (
            <Notice tone="danger" alert title="It couldn't be added">
              {change.failure.message}
            </Notice>
          ) : null}
          <FieldRow>
            <Field
              label="First day"
              id={fieldId("start")}
              error={messageFor("start")}
              disabled={change.busy}
            >
              <DateInput
                value={draft.startsOn}
                min={today}
                onValueChange={(day) =>
                  setDraft((current) => ({
                    ...current,
                    startsOn: day ?? "",
                    endsOn: day && current.endsOn < day ? day : current.endsOn,
                  }))
                }
              />
            </Field>
            <Field
              label="Last day"
              description="The same day for one day"
              id={fieldId("end")}
              error={messageFor("end")}
              disabled={change.busy}
            >
              <DateInput
                value={draft.endsOn}
                min={draft.startsOn}
                onValueChange={(day) => set("endsOn", day ?? "")}
              />
            </Field>
          </FieldRow>
          <ChoiceRow
            htmlFor={fieldId("part")}
            label="Only part of each day"
            description={
              isClosure
                ? "Otherwise the whole day is closed."
                : "Otherwise the regular hours apply."
            }
            disabled={change.busy}
            control={
              <StaffSwitch
                id={fieldId("part")}
                checked={draft.partDay}
                disabled={change.busy}
                onCheckedChange={(next) => set("partDay", next)}
              />
            }
          />
          {draft.partDay ? (
            <FieldRow>
              <Field
                label="From"
                id={fieldId("opens")}
                error={messageFor("opens")}
                disabled={change.busy}
              >
                <TextInput
                  inputMode="numeric"
                  placeholder="13:00"
                  maxLength={5}
                  value={draft.opensLocal}
                  onChange={(event) => set("opensLocal", event.target.value)}
                />
              </Field>
              <Field
                label="To"
                id={fieldId("closes")}
                error={messageFor("closes")}
                disabled={change.busy}
              >
                <TextInput
                  inputMode="numeric"
                  placeholder="14:00"
                  maxLength={5}
                  value={draft.closesLocal}
                  onChange={(event) => set("closesLocal", event.target.value)}
                />
              </Field>
            </FieldRow>
          ) : null}
          <Field
            label="Note"
            description="For staff only. Clients don't see it."
            optional
            disabled={change.busy}
          >
            <TextArea
              rows={2}
              maxLength={200}
              value={draft.reason}
              onChange={(event) => set("reason", event.target.value)}
            />
          </Field>
        </form>
      </StaffDialog>
      <AffectedBookingsDialog
        open={open && change.affected !== null}
        where={isClosure ? "inside this closure" : "outside the regular hours"}
        confirmLabels={{
          keep: isClosure ? "Close and keep them" : "Add and keep them",
          cancel: (count) => `Close and email ${count} ${count === 1 ? "client" : "clients"}`,
        }}
        bookings={change.affected ?? []}
        busy={change.busy}
        onConfirm={(choice) => void change.confirm(choice)}
        onCancel={change.dismissAffected}
      />
    </>
  );
}
