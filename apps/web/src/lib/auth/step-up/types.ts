/** API codes that require client-side step-up before retrying the same action. */
export type StepUpRequirement = "recent_auth_required" | "credential_required";

export type ActionFailureReason = StepUpRequirement | "not_found" | "server_error";

export type StepUpActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: ActionFailureReason };
