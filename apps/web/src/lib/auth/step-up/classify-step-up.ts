import type { ActionFailureReason, StepUpRequirement } from "./types";

function readApiCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** Returns a step-up requirement when the response indicates one, else null. */
export function classifyStepUpFromResponse(
  status: number,
  body: unknown,
): StepUpRequirement | null {
  if (status !== 403) return null;
  const code = readApiCode(body);
  if (code === "recent_auth_required" || code === "credential_required") {
    return code;
  }
  return null;
}

/** Plan name — identical to {@link classifyStepUpFromResponse}. */
export const classifyStepUpError = classifyStepUpFromResponse;

/** Maps HTTP failure to a closed set for `withStepUp` and callers. */
export function classifyActionFailure(status: number, body: unknown): ActionFailureReason {
  const step = classifyStepUpError(status, body);
  if (step) return step;
  if (status === 404) return "not_found";
  return "server_error";
}
