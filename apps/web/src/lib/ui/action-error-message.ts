import { missingCapabilityNotifyMessage } from "@/lib/ui/missing-capability-message";
import { normalizeApiErrorMessage } from "@auction/validators";

export { normalizeApiErrorMessage };

export type ActionErrorNotifyInput = {
  fallback: string;
  status?: number | undefined;
  errorCode?: string | undefined;
  meta?: Record<string, unknown> | undefined;
};

/** User-facing toast/message for failed server actions (maps API codes to clear copy). */
export function actionResultNotifyMessage(input: ActionErrorNotifyInput): string {
  const code =
    input.errorCode ??
    (typeof input.meta?.code === "string" ? (input.meta.code as string) : undefined);

  if (code === "session_required" || input.status === 401) {
    return "Your session has expired. Please sign in again and retry.";
  }

  if (code === "origin_blocked") {
    return "Request blocked by origin check. Reload the page and try again.";
  }

  if (code === "missing_capability" || input.meta?.code === "missing_capability") {
    return missingCapabilityNotifyMessage(input.fallback, input.meta);
  }

  return input.fallback;
}

/** Shorthand when handling `ActionResult` failure branches. */
export function actionFailureNotifyMessage(
  error: string,
  opts?: {
    status?: number | undefined;
    errorCode?: string | undefined;
    meta?: Record<string, unknown> | undefined;
  },
): string {
  return actionResultNotifyMessage({ fallback: error, ...opts });
}

/** Normalizes `{ error }` from a failed fetch body for user-facing copy. */
export function normalizeFetchErrorMessage(body: { error?: unknown }, fallback: string): string {
  return normalizeApiErrorMessage(body.error, fallback);
}
