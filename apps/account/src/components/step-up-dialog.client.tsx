"use client";

import { STEP_UP_COPY } from "@/lib/step-up";
import { ConfirmDialog, type ConfirmDialogProps } from "@auction/ui/components/confirm-dialog";
import type { StepUp } from "./use-step-up.client";

type StepUpDialogProps = {
  stepUp: StepUp;
  /**
   * The action's own confirmation, when it has one ("Sign out this device?"). "Confirm it's you"
   * then takes its place in the same dialog, and Cancel closes both. Without one, "Confirm it's
   * you" opens on its own over the page.
   */
  action?: ConfirmDialogProps | null;
};

/**
 * "Confirm it's you" for every Account action that can need a recent sign-in: one dialog, one set
 * of words. Continue opens the sign-in in a small window, or a full page when the window cannot
 * open, so the words never promise either.
 */
export function StepUpDialog({ stepUp, action }: StepUpDialogProps) {
  const { state, reason } = stepUp;
  if (state.phase === "idle" || !reason) return action ? <ConfirmDialog {...action} /> : null;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (open) return;
        stepUp.cancel();
        action?.onOpenChange(false);
      }}
      title={STEP_UP_COPY.title}
      body={
        <>
          <p>{STEP_UP_COPY.why[reason]}</p>
          {state.phase === "waiting" ? <p className="mt-3">{STEP_UP_COPY.waiting}</p> : null}
          {state.phase === "confirm" && state.notConfirmed ? (
            <output className="mt-3 block">{STEP_UP_COPY.notConfirmed}</output>
          ) : null}
        </>
      }
      confirmLabel={STEP_UP_COPY.continueLabel}
      tone="warning"
      onConfirm={stepUp.continue}
    />
  );
}
