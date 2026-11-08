import { paidPurchaseHref } from "@/lib/purchases/purchase-handover";
import type { PayPlan } from "@auction/types";

/**
 * Where a Pay link goes instead of showing the page, or `null` to show it. A link whose lots are
 * all paid opens the first of them, where the next step (choosing delivery) is, and says how many
 * lots the payment covered; every other plan is the Pay page.
 */
export function payLandingRedirect(lotIds: readonly string[], plan: PayPlan): string | null {
  const [first] = lotIds;
  if (first === undefined || plan.payable.length > 0) return null;
  const allPaid =
    plan.leftOut.length === lotIds.length && plan.leftOut.every((entry) => entry.reason === "paid");
  return allPaid ? paidPurchaseHref(first, lotIds.length) : null;
}

/** A plan whose every lot belongs to another account of the same person: open it there. */
export function belongsToAnotherAccount(plan: PayPlan): boolean {
  return (
    plan.payable.length === 0 &&
    plan.leftOut.length > 0 &&
    plan.leftOut.every((entry) => entry.reason === "other_account")
  );
}
