"use server";

import type { AdminGuestErasureResult } from "@auction/shop-contracts";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

/** Erases a guest's personal data; shop-api checks the capability, recent sign-in and email. */
export async function eraseGuestData(input: {
  guestCustomerId: string;
  confirmation: string;
  reason: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<AdminGuestErasureResult>({
    bffPath: `guests/${encodeURIComponent(input.guestCustomerId)}/erasure`,
    method: "POST",
    jsonBody: { confirmation: input.confirmation, reason: input.reason },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}
