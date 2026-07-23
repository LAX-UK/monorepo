import {
  artistWatchlistArtistIdParamSchema,
  artistWatchlistBodySchema,
  savedSearchBodySchema,
  savedSearchIdParamSchema,
  watchlistBodySchema,
  watchlistLotIdParamSchema,
  watchlistQuerySchema,
} from "@auction/validators";
import { marketingWebsiteContextFromHono } from "../../lib/marketing-website-context.js";
import { respondUserHttpJson } from "../../lib/user-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

export function attachUserWatchlistRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireAuth } = deps;

  r.get("/me/watchlist/ids", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.watchlistHttp.listWatchlistIds({ userId });
    return respondUserHttpJson(c, response);
  });

  r.get("/me/watchlist", requireAuth, zValidator("query", watchlistQuerySchema), async (c) => {
    const userId = c.get("userId") as string;
    const query = c.req.valid("query");
    const response = await container.userRoutes.watchlistHttp.listWatchlist({ userId, query });
    return respondUserHttpJson(c, response);
  });

  r.post("/me/watchlist", requireAuth, zValidator("json", watchlistBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const response = await container.userRoutes.watchlistHttp.addWatchlistLot({
      userId,
      body,
      marketingContext: marketingWebsiteContextFromHono(c),
    });
    return respondUserHttpJson(c, response);
  });

  r.delete(
    "/me/watchlist/:lotId",
    requireAuth,
    zValidator("param", watchlistLotIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { lotId } = c.req.valid("param");
      const response = await container.userRoutes.watchlistHttp.removeWatchlistLot({
        userId,
        lotId,
        marketingContext: marketingWebsiteContextFromHono(c),
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.get("/me/artist-watchlist", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.watchlistHttp.listArtistWatchlist({ userId });
    return respondUserHttpJson(c, response);
  });

  r.post(
    "/me/artist-watchlist",
    requireAuth,
    zValidator("json", artistWatchlistBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const response = await container.userRoutes.watchlistHttp.addArtistWatchlist({
        userId,
        body,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.delete(
    "/me/artist-watchlist/:artistId",
    requireAuth,
    zValidator("param", artistWatchlistArtistIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { artistId } = c.req.valid("param");
      const response = await container.userRoutes.watchlistHttp.removeArtistWatchlist({
        userId,
        artistId,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.get("/me/saved-searches", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.watchlistHttp.listSavedSearches({ userId });
    return respondUserHttpJson(c, response);
  });

  r.post(
    "/me/saved-searches",
    requireAuth,
    zValidator("json", savedSearchBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const response = await container.userRoutes.watchlistHttp.createSavedSearch({ userId, body });
      return respondUserHttpJson(c, response);
    },
  );

  r.delete(
    "/me/saved-searches/:id",
    requireAuth,
    zValidator("param", savedSearchIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const response = await container.userRoutes.watchlistHttp.removeSavedSearch({ userId, id });
      return respondUserHttpJson(c, response);
    },
  );
}
