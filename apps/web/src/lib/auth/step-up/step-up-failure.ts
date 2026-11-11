import { type ActionResult, actionFailure } from "@/lib/forms/form-result";
import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts/staff-step-up";

/** A stale staff sign-in as an action result; the page then sends the person to sign in again. */
export function stepUpRequiredFailure(): ActionResult<never> {
  return actionFailure("Recent sign-in required", undefined, 403, STAFF_STEP_UP_REQUIRED);
}
