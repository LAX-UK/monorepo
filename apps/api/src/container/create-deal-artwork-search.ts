import type { Database } from "@auction/db";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleDealArtworkSearchReader,
  DrizzleDealWorkStore,
  DrizzleLotRegisterLinkReader,
  DrizzleMarketingEnquiryRepository,
  DrizzleOpenLotPlaceReader,
} from "@auction/persistence/repositories";
import type { IMediaUrlResolver } from "../services/interfaces/media-url-resolver.js";
import type { IDealArtworkSearch } from "../services/interfaces/private-sale-deal-desk.js";
import { DealArtworkSearchService } from "../services/private-sale-deal/deal-artwork-search.service.js";

/** The picker staff choose a private sale deal's artwork from. */
export function createDealArtworkSearch(input: {
  db: Database;
  media: Pick<IMediaUrlResolver, "resolveManyUnique">;
}): IDealArtworkSearch {
  const { db } = input;
  return new DealArtworkSearchService({
    register: new DrizzleArtworkRegisterRepository(db),
    search: new DrizzleDealArtworkSearchReader(db),
    places: new DrizzleOpenLotPlaceReader(db),
    lots: new DrizzleLotRegisterLinkReader(db),
    enquiries: new DrizzleMarketingEnquiryRepository(db),
    works: new DrizzleDealWorkStore(db),
    media: input.media,
  });
}
