"use server";

import type {
  AdminAuctionOfferAssessment,
  AdminAuctionSales,
  AdminOfferAtAuctionBody,
  AdminOfferAtAuctionResponse,
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

async function read<T>(path: string, failure: string): Promise<AdminMutationResult<T>> {
  const result = await fetchAdminJson<T>(path);
  switch (result.status) {
    case "ok":
      return { ok: true, data: result.data };
    case "unauthorized":
      return { ok: false, kind: "unauthorized" };
    case "forbidden":
      return { ok: false, kind: "forbidden" };
    default:
      return { ok: false, kind: "failed", message: failure };
  }
}

/** Whether an original can move to a LAX Bid sale now, and the reasons when it cannot. */
export async function getAuctionOfferAssessment(
  artworkId: string,
): Promise<AdminMutationResult<AdminAuctionOfferAssessment>> {
  if (!UUID.test(artworkId)) return invalidInput;
  return read(`artworks/${artworkId}/auction-offer`, "Could not check this artwork. Try again.");
}

/** LAX Bid sales that can take a new lot. */
export async function listAuctionSales(): Promise<AdminMutationResult<AdminAuctionSales>> {
  return read("inventory/auction-sales", "Could not load LAX Bid sales. Try again.");
}

export async function offerAtAuction(input: {
  artworkId: string;
  body: AdminOfferAtAuctionBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminOfferAtAuctionResponse>> {
  if (!UUID.test(input.artworkId)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `artworks/${input.artworkId}/offer-at-auction`,
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}
