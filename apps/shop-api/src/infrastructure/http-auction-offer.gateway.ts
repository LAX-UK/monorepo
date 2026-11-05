import {
  AUCTION_SALES_SUBROUTE,
  BID_NOT_CONNECTED_MESSAGE,
  DRAFT_LOT_SUBROUTE,
  InventoryPeerRefusedError,
  auctionSalesAnswerSchema,
  createInventoryPeerClient,
  draftLotAnswerSchema,
  draftLotLookupAnswerSchema,
  draftLotLookupSubroute,
} from "@auction/artwork-register-contracts";
import type { AuctionOfferGateway } from "../application/ports/original-move.js";

const NOT_SET_UP = {
  error: "not_configured",
  message: BID_NOT_CONNECTED_MESSAGE,
} as const;

/** A page that shows the lot must not wait long on LAX Bid: no answer reads as "no draft lot". */
const LOOKUP_TIMEOUT_MS = 2_500;

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
    return { listSales: closed, createDraftLot: closed, findDraftLot: closed };
  }
  const connection = {
    baseUrl: BID_API_INTERNAL_URL,
    clientId: INVENTORY_MACHINE_CLIENT_ID,
    clientSecret: INVENTORY_MACHINE_CLIENT_SECRET,
    ...(fetchImpl ? { fetchImpl } : {}),
  };
  const peer = createInventoryPeerClient(connection);
  const lookupPeer = createInventoryPeerClient({ ...connection, timeoutMs: LOOKUP_TIMEOUT_MS });
  return {
    listSales: async () =>
      (await peer.call("GET", AUCTION_SALES_SUBROUTE, auctionSalesAnswerSchema)).sales,
    createDraftLot: (request) =>
      peer.call("POST", DRAFT_LOT_SUBROUTE, draftLotAnswerSchema, request),
    findDraftLot: async (registerId) =>
      (await lookupPeer.call("GET", draftLotLookupSubroute(registerId), draftLotLookupAnswerSchema))
        .lot,
  };
}
