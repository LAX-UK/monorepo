import { placeBidSchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createBidRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.post("/", requireAuth, requireBuyerRole, zValidator("json", placeBidSchema), async (c) => {
    const userId = c.get("userId") as string;
    const idem = c.req.header("idempotency-key") ?? c.req.header("Idempotency-Key");
    if (idem) {
      const cached = await container.redis.get(`idempotency:bid:${userId}:${idem}`);
      if (cached) {
        return c.json(JSON.parse(cached) as { data: unknown }, 201);
      }
    }
    const body = c.req.valid("json");
    const buyerEntity = await container.legalEntityRepository.ensurePersonalEntity(userId);
    const result = await container.bidService.placeBid(
      userId,
      buyerEntity.id,
      body.lotId,
      body.amount,
      body.maxAutoBidAmount,
    );
    if (result.isErr()) {
      const e = result.error;
      return c.json(
        e.code ? { error: e.message, code: e.code } : { error: e.message },
        asHttpStatus(e.status),
      );
    }
    const bid = result.value;
    const payload = { data: bid };
    if (idem) {
      await container.redis.set(
        `idempotency:bid:${userId}:${idem}`,
        JSON.stringify(payload),
        "EX",
        86_400,
      );
    }
    return c.json(payload, 201);
  });

  return r;
}
