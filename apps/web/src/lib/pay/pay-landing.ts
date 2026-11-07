import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { PayPlan } from "@auction/types";

/**
 * Where a Pay link goes instead of showing the page, or `null` to show it. A link for one lot
 * that is already paid opens that purchase, where the next step (choosing delivery) is; every
 * other plan is the Pay page.
 */
export function payLandingRedirect(lotIds: readonly string[], plan: PayPlan): string | null {
  const [only] = lotIds;
  if (lotIds.length !== 1 || only === undefined || plan.payable.length > 0) return null;
  const paid = plan.leftOut.length === 1 && plan.leftOut[0]?.reason === "paid";
  return paid ? `${CLIENT_ROUTES.purchases}/${only}` : null;
}

/** A plan whose every lot belongs to another account of the same person: open it there. */
export function belongsToAnotherAccount(plan: PayPlan): boolean {
  return (
    plan.payable.length === 0 &&
    plan.leftOut.length > 0 &&
    plan.leftOut.every((entry) => entry.reason === "other_account")
  );
}
