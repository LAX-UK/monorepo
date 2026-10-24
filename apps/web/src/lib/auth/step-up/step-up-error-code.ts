import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts";

/** The step-up code when an API failure carries it, so action results can pass it to the page. */
export function stepUpErrorCode(failure: { code?: string | undefined }): string | undefined {
  return failure.code === STAFF_STEP_UP_REQUIRED ? STAFF_STEP_UP_REQUIRED : undefined;
}
