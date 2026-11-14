"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import type { ClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import { resolveClerkSessionControls } from "@/features/saleroom/lib/clerk-session-controls";
import {
  adminSaleroomCloseAction,
  adminSaleroomGoLiveAction,
  adminSaleroomPauseAction,
  adminSaleroomResumeAction,
} from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/forms/form-result";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { StaffButton, cn } from "@auction/staff-ui";
import { useCallback, useState } from "react";

type Props = {
  saleId: string;
  livePhase: ClerkLivePhase;
  sessionStatus: PublicSaleroomSessionStatus["status"];
  sticky?: boolean;
  /**
   * Re-reads the session from the server. Called after every control, whether the server took
   * it or refused it, so the buttons show the state the server confirmed.
   */
  confirmFromServer?: () => Promise<unknown>;
};

/**
 * Takes the room live, pauses and resumes it, and closes it. Once the sale is running the bar
 * stays under the top bar while the page scrolls, so Pause is always in reach.
 */
export function ClerkSessionToolbar({
  saleId,
  livePhase,
  sessionStatus,
  sticky = false,
  confirmFromServer,
}: Props) {
  const confirm = useStaffConfirm();
  const [confirming, setConfirming] = useState(false);
  const { canGoLive, canPause, canResume, canClose } = resolveClerkSessionControls({
    status: sessionStatus,
    confirming,
  });

  // Holds every control until the server has been asked again what state the room is in: the
  // realtime event for this change can be missed (the socket joins after it was sent), and a
  // console left on the old state offers Pause on a room the server has already paused.
  const runControl = useCallback(
    async <T,>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> => {
      setConfirming(true);
      try {
        return await action();
      } finally {
        try {
          await confirmFromServer?.();
        } finally {
          setConfirming(false);
        }
      }
    },
    [confirmFromServer],
  );
  const concluded = livePhase === "concluded";

  return (
    <div
      className={cn(
        sticky &&
          "sticky top-13 z-20 -mx-4 border-b border-staff-line bg-staff-canvas px-4 py-3 md:-mx-8 md:px-8",
      )}
    >
      <section aria-label="Session controls" className="flex flex-wrap items-center gap-2">
        {livePhase === "setup" ? (
          <>
            <SaleroomPendingSubmit
              pendingLabel="Going live…"
              variant="primary"
              size="lg"
              disabled={!canGoLive}
              onRun={() => runControl(() => adminSaleroomGoLiveAction({ saleId }))}
            >
              Go live
            </SaleroomPendingSubmit>
            {canResume ? (
              <SaleroomPendingSubmit
                pendingLabel="Resuming…"
                variant="secondary"
                size="lg"
                onRun={() => runControl(() => adminSaleroomResumeAction({ saleId }))}
              >
                Resume
              </SaleroomPendingSubmit>
            ) : null}
          </>
        ) : null}
        {livePhase === "paused" ? (
          <SaleroomPendingSubmit
            pendingLabel="Resuming…"
            variant="primary"
            size="lg"
            disabled={!canResume}
            onRun={() => runControl(() => adminSaleroomResumeAction({ saleId }))}
          >
            Resume
          </SaleroomPendingSubmit>
        ) : null}
        {livePhase === "betweenLots" || livePhase === "selling" ? (
          <SaleroomPendingSubmit
            pendingLabel="Pausing…"
            variant="secondary"
            size="lg"
            disabled={!canPause}
            onRun={() => runControl(() => adminSaleroomPauseAction({ saleId }))}
          >
            Pause
          </SaleroomPendingSubmit>
        ) : null}
        {livePhase !== "setup" ? (
          <StaffButton
            variant={concluded ? "primary" : "secondary"}
            size="lg"
            disabled={!canClose}
            onClick={() =>
              confirm.ask({
                title: "Close the saleroom session?",
                description: concluded
                  ? "The sale is finished. Closing ends live updates for bidders and staff."
                  : "Bidders and staff stop receiving live updates until you go live again.",
                confirmLabel: "Close session",
                cancelLabel: "Keep session open",
                tone: concluded ? "default" : "danger",
                success: "Saleroom session closed",
                run: async () => {
                  const result = await runControl(() => adminSaleroomCloseAction({ saleId }));
                  return result.ok ? { ok: true } : { ok: false, error: result.error };
                },
              })
            }
          >
            Close session
          </StaffButton>
        ) : null}
      </section>
      {confirm.dialog}
    </div>
  );
}
