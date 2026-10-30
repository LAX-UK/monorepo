"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import type { ClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import {
  adminSaleroomCloseAction,
  adminSaleroomGoLiveAction,
  adminSaleroomPauseAction,
  adminSaleroomResumeAction,
} from "@/lib/actions/admin";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { StaffButton, cn } from "@auction/staff-ui";

type Props = {
  saleId: string;
  livePhase: ClerkLivePhase;
  sessionStatus: PublicSaleroomSessionStatus["status"];
  sticky?: boolean;
};

/**
 * Takes the room live, pauses and resumes it, and closes it. Once the sale is running the bar
 * stays under the top bar while the page scrolls, so Pause is always in reach.
 */
export function ClerkSessionToolbar({ saleId, livePhase, sessionStatus, sticky = false }: Props) {
  const confirm = useStaffConfirm();
  const canGoLive =
    sessionStatus === "none" || sessionStatus === "ended" || sessionStatus === "pending";
  const canPause = sessionStatus === "live";
  const canResume = sessionStatus === "paused";
  const canClose = sessionStatus === "live" || sessionStatus === "paused";
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
              onRun={() => adminSaleroomGoLiveAction({ saleId })}
            >
              Go live
            </SaleroomPendingSubmit>
            {canResume ? (
              <SaleroomPendingSubmit
                pendingLabel="Resuming…"
                variant="secondary"
                size="lg"
                onRun={() => adminSaleroomResumeAction({ saleId })}
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
            onRun={() => adminSaleroomResumeAction({ saleId })}
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
            onRun={() => adminSaleroomPauseAction({ saleId })}
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
                  const result = await adminSaleroomCloseAction({ saleId });
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
