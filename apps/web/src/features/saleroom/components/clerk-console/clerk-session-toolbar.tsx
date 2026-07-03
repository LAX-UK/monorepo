"use client";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import type { ClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import {
  adminSaleroomCloseAction,
  adminSaleroomGoLiveAction,
  adminSaleroomPauseAction,
  adminSaleroomResumeAction,
} from "@/lib/actions/admin";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { notify } from "@/lib/ui/notify";
import { cn } from "@auction/ui/lib/utils";
import { useRouter } from "next/navigation";

type Props = {
  saleId: string;
  livePhase: ClerkLivePhase;
  sessionStatus: PublicSaleroomSessionStatus["status"];
  sticky?: boolean;
};

export function ClerkSessionToolbar({ saleId, livePhase, sessionStatus, sticky = false }: Props) {
  const router = useRouter();
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
            <SaleroomPendingSubmit
              pendingLabel="Going live…"
              variant="default"
              className="min-h-11"
              disabled={!canGoLive}
              aria-disabled={!canGoLive}
              onRun={() => adminSaleroomGoLiveAction({ saleId })}
            >
              Go live
            </SaleroomPendingSubmit>
            {canResume ? (
              <SaleroomPendingSubmit
                pendingLabel="Resuming…"
                variant="default"
                className="min-h-11"
                disabled={!canResume}
                aria-disabled={!canResume}
                onRun={() => adminSaleroomResumeAction({ saleId })}
              >
                Resume
              </SaleroomPendingSubmit>
            ) : null}
          </div>
        ) : null}
        {livePhase === "paused" ? (
          <SaleroomPendingSubmit
            pendingLabel="Resuming…"
            variant="default"
            className="min-h-11"
            disabled={!canResume}
            aria-disabled={!canResume}
            onRun={() => adminSaleroomResumeAction({ saleId })}
          >
            Resume
          </SaleroomPendingSubmit>
        ) : null}
        {livePhase === "betweenLots" || livePhase === "selling" ? (
          <SaleroomPendingSubmit
            pendingLabel="Pausing…"
            variant="secondary"
            className="min-h-11"
            disabled={!canPause}
            aria-disabled={!canPause}
            onRun={() => adminSaleroomPauseAction({ saleId })}
          >
            Pause
          </SaleroomPendingSubmit>
        ) : null}
        {livePhase !== "setup" ? (
          <ConfirmActionButton
            variant={livePhase === "concluded" ? "default" : "secondary"}
            confirmTitle="Close saleroom session?"
            confirmBody={
              livePhase === "concluded"
                ? "The sale is finished. Closing ends live updates for bidders and staff."
                : "Bidders will no longer see live updates until you go live again."
            }
            confirmLabel="Close session"
            tone="warning"
            className="min-h-11"
            disabled={!canClose}
            aria-disabled={!canClose}
            onConfirmed={async () => {
              const r = await adminSaleroomCloseAction({ saleId });
              if (!r.ok) {
                notify.error(r.error);
                throw new Error(r.error);
              }
              router.refresh();
            }}
          >
            Close session
          </ConfirmActionButton>
        ) : null}
      </div>
    </div>
  );
}
