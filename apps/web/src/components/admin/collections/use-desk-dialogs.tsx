"use client";

import {
  markNotCollectedAction,
  undoHandOverCollectionAction,
} from "@/lib/actions/admin/admin-collection-desk";
import { deskRefusalMessage, newAttemptKey, visitWhen } from "@/lib/admin/collections/desk.vm";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import { ConfirmActionDialog, Notice, toast } from "@auction/staff-ui";
import type { DeskBookingView } from "@auction/types";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DeskHandOverPanel } from "./desk-hand-over-panel";
import { DeskRebookDialog } from "./desk-rebook-dialog";
import type { DeskRowHandlers } from "./desk-visit-row";

/**
 * The panel and dialogs the visit rows open, kept in one place so the day and the lists behave
 * the same: hand over (a side panel), rebook, mark not collected and undo (confirmations).
 *
 * Only the id of the visit being worked on is kept. The visit itself is looked up in the
 * `bookings` the page last loaded, so a change made from inside a panel (releasing a lot) shows
 * in it as soon as the page reloads, instead of the panel holding a stale copy.
 */
export function useDeskDialogs({
  venueId,
  today,
  bookings,
}: {
  venueId: string;
  today: string;
  bookings: readonly DeskBookingView[];
}) {
  const router = useRouter();
  const [handingId, setHandingId] = useState<string | null>(null);
  const [rebookingId, setRebookingId] = useState<string | null>(null);
  const [missingId, setMissingId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef(newAttemptKey());

  const find = (id: string | null): DeskBookingView | null =>
    id === null ? null : (bookings.find((booking) => booking.id === id) ?? null);
  const handing = find(handingId);
  const rebooking = find(rebookingId);
  const missing = find(missingId);
  const undoing = find(undoingId);

  async function run(
    action: (key: string) => Promise<Awaited<ReturnType<typeof markNotCollectedAction>>>,
    done: string,
    close: () => void,
  ) {
    setBusy(true);
    setFailure(null);
    const result = await action(key.current);
    setBusy(false);
    if (result.ok) {
      key.current = newAttemptKey();
      close();
      toast.success(done);
      router.refresh();
      return;
    }
    if (handleStaffStepUp(result)) return;
    key.current = newAttemptKey();
    close();
    setFailure(deskRefusalMessage(result.errorCode, result.error));
    router.refresh();
  }

  const handlers: DeskRowHandlers = {
    onHandOver: (booking) => setHandingId(booking.id),
    onRebook: (booking) => setRebookingId(booking.id),
    onNotCollected: (booking) => setMissingId(booking.id),
    onUndo: (booking) => setUndoingId(booking.id),
  };

  const dialogs = (
    <>
      {failure ? (
        <Notice tone="danger" title={failure} alert>
          {null}
        </Notice>
      ) : null}
      <DeskHandOverPanel booking={handing} onClose={() => setHandingId(null)} />
      <DeskRebookDialog
        booking={rebooking}
        venueId={venueId}
        today={today}
        onClose={() => setRebookingId(null)}
      />
      <ConfirmActionDialog
        open={missing !== null}
        onOpenChange={(open) => {
          if (!open) setMissingId(null);
        }}
        title={
          missing
            ? `Mark ${missing.buyer.name}'s collection as not collected?`
            : "Mark as not collected?"
        }
        description={
          missing
            ? `${visitWhen(missing)}. We email ${missing.collector.name} that we missed them, with a link to book again. The lots stay here.`
            : undefined
        }
        confirmLabel="Mark not collected"
        loading={busy}
        onConfirm={() => {
          if (!missing) return;
          const target = missing;
          void run(
            (k) => markNotCollectedAction(target.id, k),
            `${target.buyer.name}'s collection marked not collected`,
            () => setMissingId(null),
          );
        }}
      />
      <ConfirmActionDialog
        open={undoing !== null}
        onOpenChange={(open) => {
          if (!open) setUndoingId(null);
        }}
        title={undoing ? `Undo the hand-over to ${undoing.collector.name}?` : "Undo the hand-over?"}
        description="The visit goes back to booked and its lots to where they were. This is only possible for a few minutes after a hand-over."
        confirmLabel="Undo hand-over"
        tone="danger"
        loading={busy}
        onConfirm={() => {
          if (!undoing) return;
          const target = undoing;
          void run(
            (k) => undoHandOverCollectionAction(target.id, k),
            `Hand-over to ${target.collector.name} undone`,
            () => setUndoingId(null),
          );
        }}
      />
    </>
  );

  return { handlers, dialogs };
}
