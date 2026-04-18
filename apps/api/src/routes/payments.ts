import { createPaymentBodySchema, paymentIdParamSchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createPaymentRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.get("/", requireAuth, async (c) => {
    const role = c.get("userRole") ?? "user";
    const result = await container.paymentService.listAllForAdmin(role);
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  r.post("/", requireAuth, zValidator("json", createPaymentBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const result = await container.paymentService.createPendingForWinner(userId, body.lotId);
    return result.match(
      (data) => c.json({ data }, 201),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  r.post("/:id/capture", requireAuth, zValidator("param", paymentIdParamSchema), async (c) => {
    const role = c.get("userRole") ?? "user";
    const { id } = c.req.valid("param");
    const result = await container.paymentService.markCapturedByAdmin(role, id);
    return result.match(
      () => c.json({ ok: true }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  r.post("/:id/refund", requireAuth, zValidator("param", paymentIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = c.get("userRole") ?? "user";
    const { id } = c.req.valid("param");
    const result = await container.paymentService.refundPayment(userId, role, id);
    return result.match(
      () => c.json({ ok: true }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  return r;
}
