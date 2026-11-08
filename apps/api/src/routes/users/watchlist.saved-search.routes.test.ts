import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { describe, expect, it, vi } from "vitest";
import { UserWatchlistHttpApplicationService } from "../../services/user/user-watchlist-http-application.service.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";
import { attachUserWatchlistRoutes } from "./watchlist.routes.js";

const MINE = "11111111-1111-4111-8111-111111111111";
const THEIRS = "22222222-2222-4222-8222-222222222222";

function mount() {
  // Only the owner's id finds a row, as the repository's where clause does.
  const setNotifyEmail = vi.fn(async (userId: string, id: string, notifyEmail: boolean) =>
    userId === "ada" && id === MINE ? { id, userId, label: "Search: oil", notifyEmail } : null,
  );
  const watchlistHttp = new UserWatchlistHttpApplicationService({
    watchlistService: {} as never,
    userDashboardReadService: {} as never,
    lotService: {} as never,
    marketingEventService: {} as never,
    attributionStore: {} as never,
    marketingAttributionEnabled: false,
    artistWatchlistService: {} as never,
    savedSearchService: { setNotifyEmail } as never,
  });
  const users = new Hono() as UserHono;
  users.use("*", async (c, next) => {
    if (c.req.header("x-user")) c.set("userId", c.req.header("x-user") as string);
    await next();
  });
  const requireAuth: MiddlewareHandler = async (c, next) =>
    c.get("userId") ? next() : c.json({ error: "unauthorized" }, 401);
  attachUserWatchlistRoutes(users, {
    container: { userRoutes: { watchlistHttp } },
    requireAuth,
  } as unknown as UserRouteDeps);
  return { app: new Hono().route("/users", users), setNotifyEmail };
}

const patch = (
  app: Hono,
  id: string,
  body: unknown,
  user: string | null = "ada",
): Response | Promise<Response> =>
  app.request(`/users/me/saved-searches/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...(user ? { "x-user": user } : {}) },
    body: JSON.stringify(body),
  });

describe("PATCH /users/me/saved-searches/:id", () => {
  it("needs a signed-in person (401)", async () => {
    const { app, setNotifyEmail } = mount();
    expect((await patch(app, MINE, { notifyEmail: true }, null)).status).toBe(401);
    expect(setNotifyEmail).not.toHaveBeenCalled();
  });

  it("refuses an id that is not an id, or a body that is not on or off (400)", async () => {
    const { app, setNotifyEmail } = mount();
    expect((await patch(app, "not-an-id", { notifyEmail: true })).status).toBe(400);
    expect((await patch(app, MINE, {})).status).toBe(400);
    expect((await patch(app, MINE, { notifyEmail: "yes" })).status).toBe(400);
    expect(setNotifyEmail).not.toHaveBeenCalled();
  });

  it("answers 404 for a search that is not theirs, whether it exists or not", async () => {
    const { app } = mount();
    expect((await patch(app, THEIRS, { notifyEmail: true })).status).toBe(404);
    expect((await patch(app, MINE, { notifyEmail: true }, "grace")).status).toBe(404);
  });

  it("turns email on or off for their own search (200)", async () => {
    const { app, setNotifyEmail } = mount();
    const res = await patch(app, MINE, { notifyEmail: false });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { notifyEmail: boolean } }).data.notifyEmail).toBe(false);
    expect(setNotifyEmail).toHaveBeenCalledWith("ada", MINE, false);
  });
});
