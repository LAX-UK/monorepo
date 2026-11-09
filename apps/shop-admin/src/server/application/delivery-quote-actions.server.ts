"use server";

import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

/*
 * LAX Admin's calls for Delivery quotes: send a price and carrier, or say the gallery cannot
 * deliver there. shop-api applies every rule again, emails the buyer and writes the audit trail.
 */

const QUOTE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid delivery quote.",
} as const satisfies AdminMutationResult<never>;

export async function sendDeliveryQuote(input: {
  quoteId: string;
  pricePence: number;
  carrier: string;
  service?: string;
  leadTimeNote?: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<null>> {
  if (!QUOTE_ID.test(input.quoteId)) return invalidInput;
  const { quoteId, idempotencyKey, ...body } = input;
  return forwardAdminJsonMutation({
    bffPath: `orders/delivery-quotes/${quoteId}/quote`,
    method: "PUT",
    jsonBody: body,
    idempotencyKey,
  });
}

export async function declineDeliveryQuote(input: {
  quoteId: string;
  note: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<null>> {
  if (!QUOTE_ID.test(input.quoteId)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `orders/delivery-quotes/${input.quoteId}/decline`,
    method: "POST",
    jsonBody: { note: input.note },
    idempotencyKey: input.idempotencyKey,
  });
}
