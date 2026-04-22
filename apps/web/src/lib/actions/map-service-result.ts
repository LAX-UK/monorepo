import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import type { ServiceResult } from "@/lib/services/http/service-result";

export function mapServiceToAction<T>(r: ServiceResult<unknown>, data?: T): ActionResult<T> {
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  return actionSuccess(data as T);
}

export function mapServiceToActionVoid(r: ServiceResult<unknown>): ActionResult<void> {
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  return actionSuccess();
}
