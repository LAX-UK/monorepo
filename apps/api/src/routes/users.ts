import { Hono } from "hono";
import type { Container } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createUserRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator);
  const r = new Hono<{ Variables: { userId: string } }>();

  r.get("/me/bids", requireAuth, async (c) => {
    const userId = c.get("userId");
    const data = await container.bidService.listBidsWithAuctionsForBidder(userId);
    return c.json({ data });
  });

  r.get("/me/portfolio", requireAuth, async (c) => {
    const userId = c.get("userId");
    const data = await container.auctionService.list({
      winnerId: userId,
      limit: 50,
      offset: 0,
    });
    return c.json({ data });
  });

  r.get("/me", requireAuth, async (c) => {
    const userId = c.get("userId");
    const row = await container.userService.getById(userId);
    if (!row) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json({ data: { id: row.id, email: row.email, name: row.name, role: row.role } });
  });

  return r;
}
