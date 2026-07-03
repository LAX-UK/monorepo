import type { ActionResult } from "@/lib/forms/form-result";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { humanizeSetupError } from "./humanize-setup-error";

export type SaleSetupActionFailure = Extract<ActionResult<unknown>, { ok: false }>;

/** Staff-friendly message for a failed sale-setup server action result. */
export function formatSaleSetupActionError(
  failure: Pick<SaleSetupActionFailure, "error" | "status" | "errorCode" | "meta">,
): string {
  return humanizeSetupError({
    message: actionFailureNotifyMessage(failure.error, {
      status: failure.status,
      errorCode: failure.errorCode,
      meta: failure.meta,
    }),
    errorCode: failure.errorCode,
  });
}
