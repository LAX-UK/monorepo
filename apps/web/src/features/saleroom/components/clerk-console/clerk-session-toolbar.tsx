"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import type { ClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import {
  adminSaleroomCloseAction,
  adminSaleroomGoLiveAction,
  adminSaleroomPauseAction,
  adminSaleroomResumeAction,
} from "@/lib/actions/admin";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  saleId: string;
  livePhase: ClerkLivePhase;
  sessionStatus: PublicSaleroomSessionStatus["status"];
  sticky?: boolean;
};

export function ClerkSessionToolbar({ saleId, livePhase, sessionStatus, sticky = false }: Props) {
  const canGoLive =
    sessionStatus === "none" || sessionStatus === "ended" || sessionStatus === "pending";
  const canPause = sessionStatus === "live";
  const canResume = sessionStatus === "paused";
  const canClose = sessionStatus === "live" || sessionStatus === "paused";

  return (
    <div
      className={cn(
        "space-y-3",
        sticky &&
          "sticky top-0 z-20 -mx-4 border-b border-outline-variant/20 bg-surface/95 px-4 py-3 backdrop-blur-sm md:-mx-8 md:px-8",
      )}
    >
      <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Session
      </p>
      <div className="flex flex-wrap items-center gap-2" aria-label="Saleroom session controls">
        {livePhase === "setup" ? (
          <div className="flex flex-wrap gap-2">
            <form id={`saleroom-go-live-${saleId}`} action={adminSaleroomGoLiveAction}>
              <input type="hidden" name="saleId" value={saleId} />
              <SaleroomPendingSubmit
                formId={`saleroom-go-live-${saleId}`}
                pendingLabel="Going live…"
                variant="default"
                className="min-h-11"
                disabled={!canGoLive}
                aria-disabled={!canGoLive}
              >
                Go live
              </SaleroomPendingSubmit>
            </form>
            {canResume ? (
              <form id={`saleroom-resume-setup-${saleId}`} action={adminSaleroomResumeAction}>
                <input type="hidden" name="saleId" value={saleId} />
                <SaleroomPendingSubmit
                  formId={`saleroom-resume-setup-${saleId}`}
                  pendingLabel="Resuming…"
                  variant="default"
                  className="min-h-11"
                  disabled={!canResume}
                  aria-disabled={!canResume}
                >
                  Resume
                </SaleroomPendingSubmit>
              </form>
            ) : null}
          </div>
        ) : null}
        {livePhase === "paused" ? (
          <form id={`saleroom-resume-${saleId}`} action={adminSaleroomResumeAction}>
            <input type="hidden" name="saleId" value={saleId} />
            <SaleroomPendingSubmit
              formId={`saleroom-resume-${saleId}`}
              pendingLabel="Resuming…"
              variant="default"
              className="min-h-11"
              disabled={!canResume}
              aria-disabled={!canResume}
            >
              Resume
            </SaleroomPendingSubmit>
          </form>
        ) : null}
        {livePhase === "betweenLots" || livePhase === "selling" ? (
          <form id={`saleroom-pause-${saleId}`} action={adminSaleroomPauseAction}>
            <input type="hidden" name="saleId" value={saleId} />
            <SaleroomPendingSubmit
              formId={`saleroom-pause-${saleId}`}
              pendingLabel="Pausing…"
              variant="secondary"
              className="min-h-11"
              disabled={!canPause}
              aria-disabled={!canPause}
            >
              Pause
            </SaleroomPendingSubmit>
          </form>
        ) : null}
        {livePhase !== "setup" ? (
          <form id={`saleroom-close-${saleId}`} action={adminSaleroomCloseAction}>
            <input type="hidden" name="saleId" value={saleId} />
            <ConfirmFormSubmit
              formId={`saleroom-close-${saleId}`}
              variant="secondary"
              confirmTitle="Close saleroom session?"
              confirmBody="Bidders will no longer see live updates until you go live again."
              confirmLabel="Close session"
              tone="warning"
              className="min-h-11"
              disabled={!canClose}
              aria-disabled={!canClose}
            >
              Close session
            </ConfirmFormSubmit>
          </form>
        ) : null}
      </div>
    </div>
  );
}
