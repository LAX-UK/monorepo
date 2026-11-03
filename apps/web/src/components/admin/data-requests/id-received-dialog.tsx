"use client";

import { validateIdReceived } from "@/lib/admin/data-requests/data-request-forms";
import { formatDay } from "@/lib/admin/data-requests/data-requests.vm";
import { dataRequestDueOn } from "@auction/identity-contracts/data-requests";
import { DateInput, Field, FormErrorSummary, StaffButton, StaffDialog } from "@auction/staff-ui";
import { Clock } from "@auction/staff-ui/icons";
import { useId, useRef, useState } from "react";
import { DataRequestWriteFailure } from "./data-request-write-failure";
import type { WriteFailure, WriteResult } from "./use-data-request-writes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
  /** The day the request itself arrived: the proof can't be earlier. */
  requestReceivedOn: string;
  today: string;
  submit: (receivedOn: string) => Promise<WriteResult>;
  onReload: () => void;
  onDone: (dueOn: string) => void;
};

/** Records the day proof of identity arrived. That day starts the clock, and the due date follows. */
export function IdReceivedDialog({
  open,
  onOpenChange,
  reference,
  requestReceivedOn,
  today,
  submit,
  onReload,
  onDone,
}: Props) {
  const ids = useId();
  const dateId = `${ids}-date`;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [day, setDay] = useState<string | null>(today);
  const [attempted, setAttempted] = useState(false);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<WriteFailure | null>(null);

  const error = attempted ? validateIdReceived(day, { requestReceivedOn, today }) : null;
  const preview =
    day && validateIdReceived(day, { requestReceivedOn, today }) === null
      ? dataRequestDueOn(day)
      : null;

  async function proceed() {
    setAttempted(true);
    if (validateIdReceived(day, { requestReceivedOn, today }) !== null || !day) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setFailure(null);
    setBusy(true);
    const result = await submit(day);
    setBusy(false);
    if (result.ok) {
      onOpenChange(false);
      onDone(dataRequestDueOn(day));
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
      initialFocusRef={cancelRef}
      title={`Proof of identity for ${reference}`}
      description="The clock starts on the day the proof arrived, and the due date is worked out from it."
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
          <StaffButton type="submit" form={`${ids}-form`} variant="primary" loading={busy}>
            Start the clock
          </StaffButton>
        </>
      }
    >
      <form
        id={`${ids}-form`}
        noValidate
        aria-label={`Proof of identity for ${reference}`}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void proceed();
        }}
      >
        <FormErrorSummary
          errors={error ? [{ fieldId: dateId, message: error }] : []}
          focusKey={failedSubmits}
        />
        {failure ? (
          <DataRequestWriteFailure
            failure={failure}
            title="The clock couldn't be started"
            onReload={onReload}
          />
        ) : null}
        <Field label="Proof arrived on" id={dateId} error={error} disabled={busy}>
          <DateInput value={day} min={requestReceivedOn} max={today} onValueChange={setDay} />
        </Field>
        {preview ? (
          <p className="flex items-center gap-2 rounded-staff-md bg-staff-sunken px-3 py-2 text-staff-sm text-staff-fg">
            <Clock aria-hidden className="size-4 shrink-0 text-staff-muted" />
            <span>
              Due <b className="font-semibold">{formatDay(preview)}</b> · one calendar month from{" "}
              {formatDay(day as string)}
            </span>
          </p>
        ) : null}
      </form>
    </StaffDialog>
  );
}
