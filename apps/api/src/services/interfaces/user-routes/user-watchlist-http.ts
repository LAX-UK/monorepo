import type { ArtistAlertCriteria } from "@auction/domain";
import type {
  WatchlistQuery,
  artistWatchlistBodySchema,
  savedSearchBodySchema,
  watchlistBodySchema,
} from "@auction/validators";
import type { z } from "zod";
import type { WebsiteEventContext } from "../../../lib/marketing-event-factory.js";
import type { UserHttpJson } from "./user-route-http.js";

type WatchlistBody = z.infer<typeof watchlistBodySchema>;
type ArtistWatchlistBody = z.infer<typeof artistWatchlistBodySchema>;
type SavedSearchBody = z.infer<typeof savedSearchBodySchema>;

export interface IUserWatchlistHttpApplicationService {
  listWatchlistIds(input: { userId: string }): Promise<UserHttpJson>;

  listWatchlist(input: { userId: string; query: WatchlistQuery }): Promise<UserHttpJson>;

  addWatchlistLot(input: {
    userId: string;
    body: WatchlistBody;
    marketingContext: WebsiteEventContext;
  }): Promise<UserHttpJson>;

  removeWatchlistLot(input: {
    userId: string;
    lotId: string;
    marketingContext: WebsiteEventContext;
  }): Promise<UserHttpJson>;

  listArtistWatchlist(input: { userId: string }): Promise<UserHttpJson>;

  addArtistWatchlist(input: { userId: string; body: ArtistWatchlistBody }): Promise<UserHttpJson>;

  removeArtistWatchlist(input: { userId: string; artistId: string }): Promise<UserHttpJson>;

  /** Replaces the alert criteria (medium and price range) for an artist the person follows. */
  setArtistAlert(input: {
    userId: string;
    artistId: string;
    criteria: ArtistAlertCriteria;
  }): Promise<UserHttpJson>;

  listSavedSearches(input: { userId: string }): Promise<UserHttpJson>;

  createSavedSearch(input: { userId: string; body: SavedSearchBody }): Promise<UserHttpJson>;

  removeSavedSearch(input: { userId: string; id: string }): Promise<UserHttpJson>;
}
