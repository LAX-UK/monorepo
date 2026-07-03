"use client";

import { notify } from "@/lib/ui/notify";
import {
  type SaleSetupActionFailure,
  formatSaleSetupActionError,
} from "./format-sale-setup-action-error";

/** Toast a failed sale-setup server action using shared staff-friendly copy. */
export function notifySaleSetupActionFailure(
  failure: Pick<SaleSetupActionFailure, "error" | "status" | "errorCode" | "meta">,
): void {
  notify.error(formatSaleSetupActionError(failure));
}
