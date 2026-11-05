import {
  AUCTION_SALES_SUBROUTE,
  DRAFT_LOT_SUBROUTE,
  InventoryPeerRefusedError,
  auctionSalesAnswerSchema,
  createInventoryPeerClient,
  draftLotAnswerSchema,
} from "@auction/artwork-register-contracts";
import type { AuctionOfferGateway } from "../application/ports/original-move.js";

const NOT_SET_UP = {
  error: "not_configured",
  message: "Offering at auction is not set up in this environment yet.",
} as const;

/** Asks LAX Bid for its sales and for the draft lot. Without its address and credential it is closed. */
export function createHttpAuctionOfferGateway(
  env: {
    BID_API_INTERNAL_URL?: string | undefined;
    INVENTORY_MACHINE_CLIENT_ID?: string | undefined;
    INVENTORY_MACHINE_CLIENT_SECRET?: string | undefined;
  },
  fetchImpl?: typeof fetch,
): AuctionOfferGateway {
  const { BID_API_INTERNAL_URL, INVENTORY_MACHINE_CLIENT_ID, INVENTORY_MACHINE_CLIENT_SECRET } =
    env;
  if (!BID_API_INTERNAL_URL || !INVENTORY_MACHINE_CLIENT_ID || !INVENTORY_MACHINE_CLIENT_SECRET) {
    const closed = async (): Promise<never> => {
      throw new InventoryPeerRefusedError(NOT_SET_UP, 503);
    };
    return { listSales: closed, createDraftLot: closed };
  }
  const peer = createInventoryPeerClient({
    baseUrl: BID_API_INTERNAL_URL,
    clientId: INVENTORY_MACHINE_CLIENT_ID,
    clientSecret: INVENTORY_MACHINE_CLIENT_SECRET,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
  return {
    listSales: async () =>
      (await peer.call("GET", AUCTION_SALES_SUBROUTE, auctionSalesAnswerSchema)).sales,
    createDraftLot: (request) =>
      peer.call("POST", DRAFT_LOT_SUBROUTE, draftLotAnswerSchema, request),
  };
}
