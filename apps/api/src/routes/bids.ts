import { placeBidSchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createBidRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator);
  const r = new Hono<{ Variables: { userId: string } }>();

  r.post("/", requireAuth, zValidator("json", placeBidSchema), async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const result = await container.bidService.placeBid(
      userId,
      body.auctionId,
      body.amount,
      body.maxAutoBidAmount,
    );
    return result.match(
      (bid) => c.json({ data: bid }, 201),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  return r;
}
