"use server";

import type { AdminCatalogueCopy, AdminCatalogueUpdateResponse } from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COPIES: readonly AdminCatalogueCopy[] = ["lax_art", "bid_lot"];

/**
 * "Update from Zoho" for a draft lax.art listing or a draft Bid lot. shop-api decides whether the
 * copy may change (a published listing and a lot in a live or upcoming sale never do) and answers
 * with a reason when it may not. Repeating it is harmless.
 */
export async function updateCatalogueFromZoho(input: {
  registerId: string;
  copy: AdminCatalogueCopy;
}): Promise<AdminMutationResult<AdminCatalogueUpdateResponse>> {
  if (!UUID.test(input.registerId) || !COPIES.includes(input.copy)) {
    return { ok: false, kind: "validation", message: "Invalid artwork request." };
  }
  return forwardAdminJsonMutation({
    bffPath: `artwork-register/${input.registerId}/catalogue-update`,
    method: "POST",
    jsonBody: { copy: input.copy },
  });
}
