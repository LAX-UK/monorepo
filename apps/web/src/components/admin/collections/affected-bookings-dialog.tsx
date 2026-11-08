"use client";

import { AFFECTED_REASON_LABELS, formatVisitSlot } from "@/lib/admin/collections/collections.vm";
import {
  ChoiceFieldset,
  ChoiceRow,
  StaffButton,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
} from "@auction/staff-ui";
import type { StaffAffectedBooking } from "@auction/types";
import type { AffectedBookingsChoice } from "@auction/validators";
import { useId, useRef, useState } from "react";

type Props = {
  open: boolean;
  /** What is being changed, as a short phrase: "these opening hours", "this closure". */
  change: string;
  bookings: readonly StaffAffectedBooking[];
  busy: boolean;
  onConfirm: (choice: AffectedBookingsChoice) => void;
  onCancel: () => void;
};

/**
 * Shown before a change that leaves booked visits outside what the place offers. It lists the
 * visits first, then asks what to do with them: keep them booked (staff look after them), or
 * cancel them and ask the clients to book again. Nothing has been saved at this point; closing
 * the dialog leaves everything as it was.
 */
export function AffectedBookingsDialog({
  open,
  change,
  bookings,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const ids = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [choice, setChoice] = useState<AffectedBookingsChoice>("keep");
  const count = bookings.length;
  const noun = count === 1 ? "visit" : "visits";

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
      size="md"
      initialFocusRef={cancelRef}
      title={`${count} booked ${noun} would be affected`}
      description={`Saving ${change} leaves ${count === 1 ? "this visit" : "these visits"} outside what the gallery now offers. Nothing is saved until you choose.`}
      footer={
        <>
          <StaffButton ref={cancelRef} variant="secondary" disabled={busy} onClick={onCancel}>
            Go back
          </StaffButton>
          <StaffButton
            variant={choice === "cancel_and_rebook" ? "danger" : "primary"}
            loading={busy}
            onClick={() => onConfirm(choice)}
          >
            {choice === "cancel_and_rebook"
              ? `Save and cancel ${count} ${noun}`
              : "Save and keep them booked"}
          </StaffButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ul
          aria-label="Affected visits"
          className="max-h-56 divide-y divide-staff-line-subtle overflow-y-auto rounded-staff-md border border-staff-line"
        >
          {bookings.map((booking) => (
            <li
              key={booking.bookingId}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2 text-staff-sm"
            >
              <span className="font-medium text-staff-fg">
                {booking.reference}
                <span className="ml-2 font-normal text-staff-muted">
                  {formatVisitSlot(booking.start, booking.end)}
                </span>
              </span>
              <span className="text-staff-muted">{AFFECTED_REASON_LABELS[booking.reason]}</span>
            </li>
          ))}
        </ul>
        <ChoiceFieldset legend="What should happen to them?" disabled={busy}>
          <StaffRadioGroup
            value={choice}
            disabled={busy}
            onValueChange={(next) => setChoice(next as AffectedBookingsChoice)}
          >
            <ChoiceRow
              htmlFor={`${ids}-keep`}
              label="Keep them booked"
              description="The visits stay as they are. You'll need to look after them yourself."
              disabled={busy}
              control={<StaffRadio id={`${ids}-keep`} value="keep" />}
            />
            <ChoiceRow
              htmlFor={`${ids}-cancel`}
              label="Cancel them so the clients can book again"
              description="Each visit is cancelled and recorded in the audit log."
              disabled={busy}
              control={<StaffRadio id={`${ids}-cancel`} value="cancel_and_rebook" />}
            />
          </StaffRadioGroup>
        </ChoiceFieldset>
      </div>
    </StaffDialog>
  );
}
