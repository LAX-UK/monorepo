"use server";

import type {
  AdminLaxArtOfferAssessment,
  AdminLaxArtOfferBody,
  AdminLaxArtOfferResponse,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";
import { fetchAdminJson } from "./load-admin-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid artwork request.",
} as const satisfies AdminMutationResult<never>;

const offerPath = (registerId: string) => `artwork-register/${registerId}/lax-art-offer`;

/** Whether a From Zoho record can go on lax.art now, and what the dialog needs to show. */
export async function getLaxArtOfferAssessment(
  registerId: string,
): Promise<AdminMutationResult<AdminLaxArtOfferAssessment>> {
  if (!UUID.test(registerId)) return invalidInput;
  const result = await fetchAdminJson<AdminLaxArtOfferAssessment>(offerPath(registerId));
  switch (result.status) {
    case "ok":
      return { ok: true, data: result.data };
    case "unauthorized":
      return { ok: false, kind: "unauthorized" };
    case "forbidden":
      return { ok: false, kind: "forbidden" };
    default:
      return {
        ok: false,
        kind: "failed",
        message: "Could not check this artwork. Try again in a moment.",
      };
  }
}

/** Makes the lax.art draft from the record. Asking again with the same key returns the same draft. */
export async function offerOnLaxArt(input: {
  registerId: string;
  body: AdminLaxArtOfferBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminLaxArtOfferResponse>> {
  if (!UUID.test(input.registerId)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: offerPath(input.registerId),
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}
