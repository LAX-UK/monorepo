import {
  ART_LISTING_REOPEN_SUBROUTE,
  InventoryPeerRefusedError,
  createInventoryPeerClient,
  reopenListingAnswerSchema,
} from "@auction/artwork-register-contracts";
import type { Env } from "../env.js";
import type { ArtListingGateway } from "../services/inventory/return-lot-to-lax-art.service.js";

const NOT_SET_UP = {
  error: "not_configured",
  message: "Moving artworks to lax.art is not set up in this environment yet.",
} as const;

/** Asks LAX Shop to reopen a listing. Without its address and credential the move is closed. */
export function createArtListingGateway(
  env: Pick<
    Env,
    "SHOP_API_INTERNAL_URL" | "INVENTORY_MACHINE_CLIENT_ID" | "INVENTORY_MACHINE_CLIENT_SECRET"
  >,
  fetchImpl?: typeof fetch,
): ArtListingGateway {
  const { SHOP_API_INTERNAL_URL, INVENTORY_MACHINE_CLIENT_ID, INVENTORY_MACHINE_CLIENT_SECRET } =
    env;
  if (!SHOP_API_INTERNAL_URL || !INVENTORY_MACHINE_CLIENT_ID || !INVENTORY_MACHINE_CLIENT_SECRET) {
    return {
      reopen: async () => {
        throw new InventoryPeerRefusedError(NOT_SET_UP, 503);
      },
    };
  }
  const peer = createInventoryPeerClient({
    baseUrl: SHOP_API_INTERNAL_URL,
    clientId: INVENTORY_MACHINE_CLIENT_ID,
    clientSecret: INVENTORY_MACHINE_CLIENT_SECRET,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
  return {
    reopen: (request) =>
      peer.call("POST", ART_LISTING_REOPEN_SUBROUTE, reopenListingAnswerSchema, request),
  };
}
