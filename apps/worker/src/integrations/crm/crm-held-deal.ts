import type { CrmPurchase } from "./crm-event-mappers.js";
import type { CrmFieldValue } from "./crm-gateway.js";

/** What the ledger keeps for a deal that waits for its buyer's Contact. */
export type CrmHeldDeal = {
  fields: Record<string, CrmFieldValue>;
  purchase: CrmPurchase;
};

export function toHeldPayload(held: CrmHeldDeal): Record<string, unknown> {
  return { fields: held.fields, purchase: held.purchase };
}

export function readHeldDeal(payload: Record<string, unknown> | null): CrmHeldDeal | null {
  if (!payload || typeof payload.fields !== "object" || payload.fields === null) return null;
  const purchase = payload.purchase as CrmPurchase | undefined;
  if (!purchase || (purchase.product !== "LAX Bid" && purchase.product !== "LAX Shop")) {
    return null;
  }
  return {
    fields: payload.fields as Record<string, CrmFieldValue>,
    purchase: { product: purchase.product, paid: purchase.paid === true },
  };
}
