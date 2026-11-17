"use server";

import type { AdminArtworkConsignor, AdminArtworkConsignorSetBody } from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

/*
 * Setting who consigned an original, from its From Zoho record. It needs a recent sign-in;
 * shop-api checks the capability, the client and every rule again.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setArtworkConsignor(input: {
  registerId: string;
  body: AdminArtworkConsignorSetBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminArtworkConsignor>> {
  if (!UUID.test(input.registerId)) {
    return { ok: false, kind: "validation", message: "Invalid consignor request." };
  }
  return forwardAdminJsonMutation<AdminArtworkConsignor>({
    bffPath: `artwork-register/${input.registerId}/consignor`,
    method: "PUT",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}
