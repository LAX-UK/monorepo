import { ArtworkOfferLock } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import type { PlatformCatalogLegalEntityIdProvider } from "@auction/persistence/interfaces";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleAuctionOfferReader,
  DrizzleLotRegisterLinkReader,
} from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import { createArtListingGateway } from "../infrastructure/http-art-listing.gateway.js";
import {
  type ArtistMatcher,
  AuctionDraftLotService,
  type DraftLotCreator,
} from "../services/inventory/auction-draft-lot.service.js";
import type { InventoryMoveServices } from "../services/inventory/inventory-move-services.js";
import { ReturnLotToLaxArtService } from "../services/inventory/return-lot-to-lax-art.service.js";

/** Composes LAX Bid's two halves of moving an original between lax.art and auction. */
export function createInventoryMoveServices(input: {
  db: Database;
  env: Pick<
    Env,
    "SHOP_API_INTERNAL_URL" | "INVENTORY_MACHINE_CLIENT_ID" | "INVENTORY_MACHINE_CLIENT_SECRET"
  >;
  lots: DraftLotCreator;
  artists: ArtistMatcher;
  resolveHouseSellerLegalEntityId: PlatformCatalogLegalEntityIdProvider;
}): InventoryMoveServices {
  const { db } = input;
  const register = new DrizzleArtworkRegisterRepository(db);
  return {
    draftLots: new AuctionDraftLotService({
      offers: new DrizzleAuctionOfferReader(db),
      register,
      lots: input.lots,
      artists: input.artists,
      resolveHouseSellerLegalEntityId: input.resolveHouseSellerLegalEntityId,
    }),
    returnToLaxArt: new ReturnLotToLaxArtService({
      links: new DrizzleLotRegisterLinkReader(db),
      register,
      lock: new ArtworkOfferLock(register),
      shop: createArtListingGateway(input.env),
      history: register,
    }),
  };
}
