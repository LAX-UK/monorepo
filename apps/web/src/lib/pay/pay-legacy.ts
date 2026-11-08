import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { paidPurchaseHref } from "@/lib/purchases/purchase-handover";
import type { PayPlan } from "@auction/types";
import { payLandingRedirect } from "./pay-landing";
import { payHref } from "./pay-links";

/**
 * Where an old checkout address goes. `payment` is what the payment page appended when it sent
 * the person back (`success` or `cancelled`); `plan` is the plan read for the lots, if it could be.
 *
 * - Back after paying: the purchase, where its state (processing, paid) is told. Never the Pay
 *   page, which could offer a fresh payment while one is still being confirmed.
 * - Back without paying: the Pay page, with a note that nothing was charged.
 * - A single lot already paid: its purchase.
 * - Anything else: the Pay page.
 */
export function legacyCheckoutTarget(
  lotIds: readonly string[],
  payment: string | string[] | undefined,
  plan: PayPlan | null,
): string {
  const returned = Array.isArray(payment) ? payment[0] : payment;
  const [only] = lotIds;
  if (returned === "success") {
    return lotIds.length === 1 && only ? paidPurchaseHref(only, 1) : CLIENT_ROUTES.purchases;
  }
  const paid = plan ? payLandingRedirect(lotIds, plan) : null;
  if (paid) return paid;
  return payHref(lotIds, returned === "cancelled" ? { returned: "cancelled" } : {});
}
