import { createPaymentBodySchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createPaymentRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator);
  const r = new Hono<{ Variables: { userId: string } }>();

  r.post("/", requireAuth, zValidator("json", createPaymentBodySchema), async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const result = await container.paymentService.createPendingForWinner(userId, body.auctionId);
    return result.match(
      (data) => c.json({ data }, 201),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  return r;
}
