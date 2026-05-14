import { isAuthErrorCode } from "@/lib/auth/auth-error-code";
import type { ActionResult } from "@/lib/forms/form-result";
import type { StepUpActionResult, StepUpRequirement } from "./types";

function isStepUpCode(code: string | undefined): code is StepUpRequirement {
  return code === "recent_auth_required" || code === "credential_required";
}

/** Maps server {@link ActionResult} into {@link StepUpActionResult} for `withStepUp`. */
export function actionResultToStepUpVoid(r: ActionResult<void>): StepUpActionResult<void> {
  if (r.ok) return { ok: true, value: undefined };
  if (r.errorCode && isAuthErrorCode(r.errorCode) && isStepUpCode(r.errorCode)) {
    return { ok: false, reason: r.errorCode };
  }
  return { ok: false, reason: "server_error" };
}
