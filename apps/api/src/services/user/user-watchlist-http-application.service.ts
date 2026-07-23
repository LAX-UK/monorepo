import type { IAttributionStore } from "@auction/marketing-events";
import type { WatchlistQuery } from "@auction/validators";
import type { savedSearchBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { LotReadPort } from "../../container/container-slices.js";
import { buildEnrichedWebsiteUserEvent } from "../../lib/marketing-attribution-context.js";
import type { WebsiteEventContext } from "../../lib/marketing-event-factory.js";
import type { ArtistWatchlistService } from "../artist-watchlist.service.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { IUserWatchlistHttpApplicationService } from "../interfaces/user-routes/user-watchlist-http.js";
import type { SavedSearchService } from "../saved-search.service.js";
import type { UserDashboardReadService } from "../user-dashboard-read.service.js";
import type { WatchlistService } from "../watchlist.service.js";

type SavedSearchBody = z.infer<typeof savedSearchBodySchema>;

export type UserWatchlistHttpDeps = {
  watchlistService: WatchlistService;
  userDashboardReadService: UserDashboardReadService;
  lotService: LotReadPort;
  marketingEventService: IMarketingEventService;
  attributionStore: IAttributionStore;
  marketingAttributionEnabled: boolean;
  artistWatchlistService: ArtistWatchlistService;
  savedSearchService: SavedSearchService;
};

export class UserWatchlistHttpApplicationService implements IUserWatchlistHttpApplicationService {
  constructor(private readonly deps: UserWatchlistHttpDeps) {}

  async listWatchlistIds(input: { userId: string }): Promise<UserHttpJson> {
    const lotIds = await this.deps.watchlistService.listIds(input.userId);
    return { status: 200, body: { data: { lotIds } } };
  }

  async listWatchlist(input: { userId: string; query: WatchlistQuery }): Promise<UserHttpJson> {
    const data = await this.deps.userDashboardReadService.listWatchlistForUser(input.userId, {
      sort: input.query.sort as never,
      ...(input.query.status ? { status: input.query.status as never } : {}),
      ...(input.query.categoryIds ? { categoryIds: input.query.categoryIds } : {}),
    });
    return { status: 200, body: { data } };
  }

  async addWatchlistLot(input: {
    userId: string;
    body: { lotId: string };
    marketingContext: WebsiteEventContext;
  }): Promise<UserHttpJson> {
    const lot = await this.deps.lotService.getById(input.body.lotId);
    if (!lot) return { status: 404, body: { error: "Lot not found" } };
    const eventId = crypto.randomUUID();
    const marketingEvent = await buildEnrichedWebsiteUserEvent(
      input.marketingContext,
      {
        name: "AddToWishlist",
        eventId,
        userId: input.userId,
        customData: { lotId: input.body.lotId },
      },
      {
        attributionEnabled: this.deps.marketingAttributionEnabled,
        attributionStore: this.deps.attributionStore,
      },
    );
    const row = await this.deps.watchlistService.addWithMarketingEvent(
      input.userId,
      input.body.lotId,
      marketingEvent,
    );
    await this.deps.marketingEventService.enqueue(marketingEvent);
    return { status: 201, body: { data: row, marketingEventId: eventId } };
  }

  async removeWatchlistLot(input: {
    userId: string;
    lotId: string;
    marketingContext: WebsiteEventContext;
  }): Promise<UserHttpJson> {
    const eventId = crypto.randomUUID();
    const marketingEvent = await buildEnrichedWebsiteUserEvent(
      input.marketingContext,
      {
        name: "RemoveFromWishlist",
        eventId,
        userId: input.userId,
        customData: { lotId: input.lotId },
      },
      {
        attributionEnabled: this.deps.marketingAttributionEnabled,
        attributionStore: this.deps.attributionStore,
      },
    );
    await this.deps.watchlistService.removeWithMarketingEvent(
      input.userId,
      input.lotId,
      marketingEvent,
    );
    await this.deps.marketingEventService.enqueue(marketingEvent);
    return { status: 204, body: null };
  }

  async listArtistWatchlist(input: { userId: string }): Promise<UserHttpJson> {
    const rows = await this.deps.artistWatchlistService.list(input.userId);
    return {
      status: 200,
      body: {
        data: rows.map((row) => ({ artistId: row.artistId, id: row.id, createdAt: row.createdAt })),
      },
    };
  }

  async addArtistWatchlist(input: {
    userId: string;
    body: { artistId: string };
  }): Promise<UserHttpJson> {
    const row = await this.deps.artistWatchlistService.add(input.userId, input.body.artistId);
    if (!row) return { status: 404, body: { error: "Artist not found" } };
    return { status: 201, body: { data: row } };
  }

  async removeArtistWatchlist(input: {
    userId: string;
    artistId: string;
  }): Promise<UserHttpJson> {
    await this.deps.artistWatchlistService.remove(input.userId, input.artistId);
    return { status: 204, body: null };
  }

  async listSavedSearches(input: { userId: string }): Promise<UserHttpJson> {
    const rows = await this.deps.savedSearchService.list(input.userId);
    return { status: 200, body: { data: rows } };
  }

  async createSavedSearch(input: {
    userId: string;
    body: SavedSearchBody;
  }): Promise<UserHttpJson> {
    const row = await this.deps.savedSearchService.create(input.userId, input.body);
    return { status: 201, body: { data: row } };
  }

  async removeSavedSearch(input: { userId: string; id: string }): Promise<UserHttpJson> {
    const removed = await this.deps.savedSearchService.remove(input.userId, input.id);
    if (!removed) return { status: 404, body: { error: "Not found" } };
    return { status: 204, body: null };
  }
}
