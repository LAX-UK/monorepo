import "server-only";

import { getServerDataContainer } from "@/lib/data/container.server";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { purchaseRequestAccountId } from "@/lib/purchases/purchase-account";
import { type PayPlanRead, readPayPlanResponse } from "./pay-plan-read";

const BASE = "/legal-entities/purchases";

/**
 * Calls the Pay endpoints for the account in use: an organisation names itself, a person's own
 * account sends no account, as every purchase request does.
 */
async function payFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const scope = await (await getServerDataContainer()).buying.scope();
  const account = purchaseRequestAccountId(scope.account);
  return authedServerFetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(account ? { [X_LEGAL_ENTITY_ID_HEADER]: account } : {}),
    },
  });
}

/** What one payment of these lots covers, or why it cannot be shown. Only reads. */
export async function loadPayPlan(lotIds: readonly string[]): Promise<PayPlanRead> {
  try {
    const res = await payFetch(`/pay-plan?lots=${lotIds.map(encodeURIComponent).join(",")}`);
    const body: unknown = await res.json().catch(() => null);
    return readPayPlanResponse(res.status, body);
  } catch {
    return { kind: "unavailable" };
  }
}

/** Asks the API to open the payment for exactly the lots and total that were shown. */
export async function postPay(body: {
  lotIds: string[];
  expectedTotalPence: number;
}): Promise<{ status: number; body: unknown }> {
  const res = await payFetch("/pay-several", {
    method: "POST",
    body: JSON.stringify({
      lotIds: body.lotIds,
      expectedTotalPence: body.expectedTotalPence,
      expectedLotIds: body.lotIds,
    }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
