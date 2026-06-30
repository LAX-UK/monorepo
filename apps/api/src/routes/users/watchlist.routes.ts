import {
  artistWatchlistArtistIdParamSchema,
  artistWatchlistBodySchema,
  savedSearchBodySchema,
  savedSearchIdParamSchema,
  watchlistBodySchema,
  watchlistLotIdParamSchema,
  watchlistQuerySchema,
} from "@auction/validators";
import { buildWebsiteUserEvent } from "../../lib/marketing-event-factory.js";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

export function attachUserWatchlistRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireAuth } = deps;

  r.get("/me/watchlist/ids", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const lotIds = await container.watchlistService.listIds(userId);
    return c.json({ data: { lotIds } });
  });

  r.get("/me/watchlist", requireAuth, zValidator("query", watchlistQuerySchema), async (c) => {
    const userId = c.get("userId") as string;
    const query = c.req.valid("query");
    const data = await container.userDashboardReadService.listWatchlistForUser(userId, {
      sort: query.sort,
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryIds ? { categoryIds: query.categoryIds } : {}),
    });
    return c.json({ data });
  });

  r.post("/me/watchlist", requireAuth, zValidator("json", watchlistBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const { lotId } = c.req.valid("json");
    const lot = await container.repoFactory.root.lot.findById(lotId);
    if (!lot) {
      return c.json({ error: "Lot not found" }, 404);
    }
    const eventId = crypto.randomUUID();
    const marketingEvent = buildWebsiteUserEvent(c, {
      name: "AddToWishlist",
      eventId,
      userId,
      customData: { lotId },
    });
    const row = await container.watchlistService.addWithMarketingEvent(
      userId,
      lotId,
      marketingEvent,
    );
    await container.marketingEventService.enqueue(marketingEvent);
    return c.json({ data: row, marketingEventId: eventId }, 201);
  });

  r.delete(
    "/me/watchlist/:lotId",
    requireAuth,
    zValidator("param", watchlistLotIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { lotId } = c.req.valid("param");
      const eventId = crypto.randomUUID();
      const marketingEvent = buildWebsiteUserEvent(c, {
        name: "RemoveFromWishlist",
        eventId,
        userId,
        customData: { lotId },
      });
      await container.watchlistService.removeWithMarketingEvent(userId, lotId, marketingEvent);
      await container.marketingEventService.enqueue(marketingEvent);
      return c.body(null, 204);
    },
  );

  r.get("/me/artist-watchlist", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const rows = await container.artistWatchlistService.list(userId);
    return c.json({
      data: rows.map((row) => ({ artistId: row.artistId, id: row.id, createdAt: row.createdAt })),
    });
  });

  r.post(
    "/me/artist-watchlist",
    requireAuth,
    zValidator("json", artistWatchlistBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { artistId } = c.req.valid("json");
      const row = await container.artistWatchlistService.add(userId, artistId);
      if (!row) {
        return c.json({ error: "Artist not found" }, 404);
      }
      return c.json({ data: row }, 201);
    },
  );

  r.delete(
    "/me/artist-watchlist/:artistId",
    requireAuth,
    zValidator("param", artistWatchlistArtistIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { artistId } = c.req.valid("param");
      await container.artistWatchlistService.remove(userId, artistId);
      return c.body(null, 204);
    },
  );

  r.get("/me/saved-searches", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const rows = await container.savedSearchService.list(userId);
    return c.json({ data: rows });
  });

  r.post(
    "/me/saved-searches",
    requireAuth,
    zValidator("json", savedSearchBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const row = await container.savedSearchService.create(userId, {
        label: body.label,
        query: body.query,
        notifyEmail: body.notifyEmail,
      });
      return c.json({ data: row }, 201);
    },
  );

  r.delete(
    "/me/saved-searches/:id",
    requireAuth,
    zValidator("param", savedSearchIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const removed = await container.savedSearchService.remove(userId, id);
      if (!removed) return c.json({ error: "Not found" }, 404);
      return c.body(null, 204);
    },
  );
}
