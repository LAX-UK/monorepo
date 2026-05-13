import { mapApiServiceFailure } from "@/lib/auth/auth-error-code";
import { type ActionResult, actionFailure } from "@/lib/forms/form-result";
import type { ServiceResult } from "@/lib/services/http/service-result";

/** Maps an authed API {@link ServiceResult} failure into a server {@link ActionResult} with `errorCode`. */
export function actionFailureFromService<T = never>(
  r: Extract<ServiceResult<unknown>, { ok: false }>,
): ActionResult<T> {
  const errorCode = mapApiServiceFailure({
    status: r.status,
    apiCode: r.code,
  });
  return actionFailure(r.message, undefined, r.status, errorCode);
}
