"use client";

import { rebookCollectionAction } from "@/lib/actions/admin/admin-collection-desk";
import { deskDayLabel, deskRefusalMessage, timeRange } from "@/lib/admin/collections/desk.vm";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import { Field, Notice, StaffButton, StaffDialog, TextArea, toast } from "@auction/staff-ui";
import type { DeskBookingView } from "@auction/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type ChosenSlot, DeskSlotChooser } from "./desk-slot-chooser";

/**
 * Moves a live visit to another time, or books a new one after a missed visit, by the same rules
 * the client has. Staff may go over capacity or inside the notice period for a client they have
 * spoken to; that needs a reason, which is recorded with their name.
 */
export function DeskRebookDialog({
  booking,
  venueId,
  today,
  onClose,
}: {
  booking: DeskBookingView | null;
  venueId: string;
  today: string;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(booking);
  if (booking && booking !== shown) setShown(booking);
  return (
    <StaffDialog
      open={booking !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={shown?.status === "not_collected" ? "Book a new time" : "Rebook"}
      description={
        shown ? `${shown.buyer.name} · ${shown.reference} · now ${timeRange(shown)}` : undefined
      }
      size="md"
    >
      {shown ? (
        <RebookForm
          key={shown.id + shown.version}
          booking={shown}
          venueId={venueId}
          today={today}
          onClose={onClose}
        />
      ) : null}
    </StaffDialog>
  );
}

function RebookForm({
  booking,
  venueId,
  today,
  onClose,
}: {
  booking: DeskBookingView;
  venueId: string;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [slot, setSlot] = useState<ChosenSlot>(null);
  const [reason, setReason] = useState("");
  const [needsReason, setNeedsReason] = useState(false);
  const [slotError, setSlotError] = useState<string | undefined>();
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const asked = needsReason || slot?.full === true;

  async function submit() {
    setFailure(null);
    if (!slot) {
      setSlotError("Choose a time.");
      return;
    }
    if (asked && reason.trim().length < 3) {
      setReasonError("Give a reason: it is recorded with your name.");
      return;
    }
    setBusy(true);
    const result = await rebookCollectionAction(booking.id, {
      version: booking.version,
      slotStart: slot.start,
      ...(asked ? { override: { reason: reason.trim() } } : {}),
    });
    setBusy(false);
    if (result.ok) {
      toast.success(`${booking.reference} booked for ${deskDayLabel(slot.start.slice(0, 10))}`);
      onClose();
      router.refresh();
      return;
    }
    if (handleStaffStepUp(result)) return;
    if (result.errorCode === "slot_full" || result.errorCode === "notice_passed") {
      setNeedsReason(true);
      setReasonError(deskRefusalMessage(result.errorCode, result.error));
      return;
    }
    setFailure(deskRefusalMessage(result.errorCode, result.error, result.meta));
    if (result.errorCode === "booking_changed") router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-5">
      {failure ? (
        <Notice tone="danger" title={failure} alert>
          {null}
        </Notice>
      ) : null}
      <DeskSlotChooser
        venueId={venueId}
        initialDate={booking.status === "booked" ? booking.start.slice(0, 10) : today}
        value={slot?.start ?? null}
        error={slotError}
        onChange={(next) => {
          setSlot(next);
          setSlotError(undefined);
        }}
      />
      {asked ? (
        <Field
          label="Reason"
          description="For going over capacity or inside the notice period. Kept with your name; never shown to the client."
          error={reasonError}
        >
          <TextArea
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(undefined);
            }}
            rows={3}
          />
        </Field>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <StaffButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </StaffButton>
        <StaffButton variant="primary" onClick={submit} loading={busy}>
          {booking.status === "booked" ? "Move booking" : "Book this time"}
        </StaffButton>
      </div>
    </div>
  );
}
