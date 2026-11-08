import "server-only";

import { purchasesApiFetch } from "@/lib/purchases/purchases-api.server";
import type { BankTransferInstructions, PayPlan } from "@auction/types";
import type { PayMethod } from "./pay-methods";
import { type PayPlanRead, readPayPlanResponse } from "./pay-plan-read";
import { parsePayProgressRead } from "./pay-plan.schema";
import { readPayTransferResponse } from "./pay-transfer-read";

/** What one payment of these lots covers, or why it cannot be shown. Only reads. */
export async function loadPayPlan(lotIds: readonly string[]): Promise<PayPlanRead> {
  try {
    const res = await purchasesApiFetch(
      `/pay-plan?lots=${lotIds.map(encodeURIComponent).join(",")}`,
    );
    const body: unknown = await res.json().catch(() => null);
    return readPayPlanResponse(res.status, body);
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * Where a payment under way for these lots stands, read lightly for a page that waits.
 * `undefined` when it could not be read: the page keeps waiting and asks again.
 */
export async function loadPayProgress(
  lotIds: readonly string[],
): Promise<{ progress: PayPlan["progress"] } | undefined> {
  try {
    const res = await purchasesApiFetch(
      `/pay-progress?lots=${lotIds.map(encodeURIComponent).join(",")}`,
    );
    if (!res.ok) return undefined;
    const body: unknown = await res.json().catch(() => null);
    const data =
      body && typeof body === "object" && "data" in body ? (body as { data: unknown }).data : null;
    return parsePayProgressRead(data);
  } catch {
    return undefined;
  }
}

/**
 * The account details of a bank transfer already chosen for these lots, or `null` when there are
 * none to show. A failure is `null`, never an error page: the lots and money are still on screen.
 */
export async function loadPayTransfer(
  lotIds: readonly string[],
): Promise<BankTransferInstructions | null> {
  try {
    const res = await purchasesApiFetch(
      `/pay-transfer?lots=${lotIds.map(encodeURIComponent).join(",")}`,
    );
    return readPayTransferResponse(res.status, await res.json().catch(() => null));
  } catch {
    return null;
  }
}

/**
 * Asks the API to open the payment for exactly the lots and total that were shown, by the method
 * the person chose. The server refuses a method that does not fit the total.
 */
export async function postPay(body: {
  lotIds: string[];
  expectedTotalPence: number;
  method: PayMethod;
}): Promise<{ status: number; body: unknown }> {
  const res = await purchasesApiFetch("/pay-several", {
    method: "POST",
    body: JSON.stringify({
      lotIds: body.lotIds,
      expectedTotalPence: body.expectedTotalPence,
      expectedLotIds: body.lotIds,
      method: body.method,
    }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
