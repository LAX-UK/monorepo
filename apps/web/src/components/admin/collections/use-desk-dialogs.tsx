"use client";

import {
  markNotCollectedAction,
  undoHandOverCollectionAction,
} from "@/lib/actions/admin/admin-collection-desk";
import { deskRefusalMessage, newAttemptKey, timeRange } from "@/lib/admin/collections/desk.vm";
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
 */
export function useDeskDialogs({ venueId, today }: { venueId: string; today: string }) {
  const router = useRouter();
  const [handing, setHanding] = useState<DeskBookingView | null>(null);
  const [rebooking, setRebooking] = useState<DeskBookingView | null>(null);
  const [missing, setMissing] = useState<DeskBookingView | null>(null);
  const [undoing, setUndoing] = useState<DeskBookingView | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef(newAttemptKey());

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
    if (result.errorCode === "booking_changed") router.refresh();
  }

  const handlers: DeskRowHandlers = {
    onHandOver: setHanding,
    onRebook: setRebooking,
    onNotCollected: setMissing,
    onUndo: setUndoing,
  };

  const dialogs = (
    <>
      {failure ? (
        <Notice tone="danger" title={failure} alert>
          {null}
        </Notice>
      ) : null}
      <DeskHandOverPanel booking={handing} onClose={() => setHanding(null)} />
      <DeskRebookDialog
        booking={rebooking}
        venueId={venueId}
        today={today}
        onClose={() => setRebooking(null)}
      />
      <ConfirmActionDialog
        open={missing !== null}
        onOpenChange={(open) => {
          if (!open) setMissing(null);
        }}
        title={missing ? `Mark ${missing.reference} as not collected?` : "Mark as not collected?"}
        description={
          <>
            {missing ? `${missing.buyer.name} didn't come for ${timeRange(missing)}. ` : ""}
            The lots stay with us, and the buyer is emailed "We missed you" with a way to book
            again. There's no fee. It appears under Not collected so someone can follow up.
          </>
        }
        confirmLabel="Mark not collected"
        loading={busy}
        onConfirm={() => {
          if (!missing) return;
          const target = missing;
          void run(
            (k) => markNotCollectedAction(target.id, k),
            `${target.reference} marked not collected`,
            () => setMissing(null),
          );
        }}
      />
      <ConfirmActionDialog
        open={undoing !== null}
        onOpenChange={(open) => {
          if (!open) setUndoing(null);
        }}
        title={undoing ? `Undo the hand-over of ${undoing.reference}?` : "Undo the hand-over?"}
        description="The visit goes back to booked and its lots to still to collect. This is only possible for a few minutes after a hand-over."
        confirmLabel="Undo hand-over"
        tone="danger"
        loading={busy}
        onConfirm={() => {
          if (!undoing) return;
          const target = undoing;
          void run(
            (k) => undoHandOverCollectionAction(target.id, k),
            `Hand-over of ${target.reference} undone`,
            () => setUndoing(null),
          );
        }}
      />
    </>
  );

  return { handlers, dialogs };
}
