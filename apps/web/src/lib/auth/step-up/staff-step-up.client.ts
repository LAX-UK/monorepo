"use client";

import { notify } from "@/lib/ui/notify";
import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts";
import { recentReauthAttempt, redirectToHostedReauth } from "./use-step-up-coordinator";

/** How long the notice stays readable before the browser leaves for the sign-in page. */
export const STAFF_STEP_UP_REDIRECT_DELAY_MS = 1200;

const NOTICE_ID = "staff-step-up";

type StepUpFailure = { errorCode?: string | undefined; error?: string | undefined };

/** True for a failed action result (or bare code) that asks for a fresh sign-in. */
export function isStaffStepUpRequired(failure: StepUpFailure | string | undefined): boolean {
  if (failure === undefined) return false;
  if (typeof failure === "string") return failure === STAFF_STEP_UP_REQUIRED;
  return failure.errorCode === STAFF_STEP_UP_REQUIRED || failure.error === STAFF_STEP_UP_REQUIRED;
}

/**
 * When a staff action fails because the sign-in is too old, says so and sends the person
 * through hosted re-authentication, which returns to this page so they can repeat the action.
 * If a re-authentication already ran in the last two minutes and the API still asks, it stops
 * with an error rather than looping. Returns true when it handled the failure.
 */
export function handleStaffStepUp(failure: StepUpFailure | string | undefined): boolean {
  if (!isStaffStepUpRequired(failure)) return false;
  if (recentReauthAttempt()) {
    notify.error("We could not confirm your sign-in", {
      description: "Sign out, sign back in, then try the action again.",
    });
    return true;
  }
  notify.info("Confirm it is you to continue", {
    id: NOTICE_ID,
    description: "Taking you to sign in again. You will come back to this page.",
  });
  setTimeout(redirectToHostedReauth, STAFF_STEP_UP_REDIRECT_DELAY_MS);
  return true;
}
