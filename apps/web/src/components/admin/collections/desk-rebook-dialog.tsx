"use client";

import { rebookCollectionAction } from "@/lib/actions/admin/admin-collection-desk";
import { deskRefusalMessage, instantDayLabel, visitWhen } from "@/lib/admin/collections/desk.vm";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import { londonDateKey } from "@auction/domain";
import { Notice, StaffButton, StaffDialog, formatStaffTime, toast } from "@auction/staff-ui";
import type { DeskBookingView } from "@auction/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeskOverrideField } from "./desk-override-field";
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
      title={shown ? `Rebook ${shown.buyer.name}` : "Rebook"}
      description={
        shown
          ? shown.status === "not_collected"
            ? `Missed ${visitWhen(shown)}. We email the new time and a calendar invite.`
            : `Now ${visitWhen(shown)}. We email the new time and an updated calendar invite.`
          : undefined
      }
      size="lg"
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
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [needsReason, setNeedsReason] = useState(false);
  const [slotError, setSlotError] = useState<string | undefined>();
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const required = needsReason || slot?.full === true;
  const asked = override || required;

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
      toast.success(`${booking.buyer.name} booked for ${instantDayLabel(slot.start)}`);
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
    if (result.errorCode === "booking_changed" || result.errorCode === "lot_not_collectable") {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {failure ? (
        <Notice tone="danger" title={failure} alert>
          {null}
        </Notice>
      ) : null}
      <DeskSlotChooser
        venueId={venueId}
        initialDate={booking.status === "booked" ? londonDateKey(new Date(booking.start)) : today}
        value={slot?.start ?? null}
        error={slotError}
        onChange={(next) => {
          setSlot(next);
          setSlotError(undefined);
        }}
      />
      <DeskOverrideField
        id="rebook-reason"
        checked={override}
        required={required}
        onCheckedChange={setOverride}
        reason={reason}
        onReasonChange={(next) => {
          setReason(next);
          setReasonError(undefined);
        }}
        error={reasonError}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <StaffButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </StaffButton>
        <StaffButton variant="primary" onClick={submit} loading={busy}>
          {slot
            ? `Rebook for ${instantDayLabel(slot.start)}, ${formatStaffTime(slot.start)}`
            : "Rebook"}
        </StaffButton>
      </div>
    </div>
  );
}
