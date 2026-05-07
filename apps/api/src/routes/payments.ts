import { createPaymentBodySchema, paymentIdParamSchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import { requireFinanceEntityWrite } from "../middleware/require-capability.js";
import { createOptionalLegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createPaymentRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = createOptionalLegalEntityContext(
    container.legalEntityRepository,
    (input) => container.impersonationAuditService.recordSessionTimedOut(input),
    container.impersonationSessionService,
  );
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; legalEntityContext?: LegalEntityContext };
  }>();

  r.get("/", requireAuth, async (c) => {
    const role = c.get("userRole") ?? "client";
    const result = await container.paymentService.listAllForAdmin(role);
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  r.post(
    "/",
    requireAuth,
    requireBuyerRole,
    zValidator("json", createPaymentBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const result = await container.paymentService.createPendingForWinner(userId, body.lotId);
      return result.match(
        (data) =>
          c.json(
            {
              data: {
                paymentId: data.paymentId,
                clientSecret: data.clientSecret,
                checkoutUrl: data.checkoutUrl,
              },
            },
            201,
          ),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/:id/capture",
    requireAuth,
    requireContext,
    requireFinanceEntityWrite,
    zValidator("param", paymentIdParamSchema),
    async (c) => {
      const role = c.get("userRole") ?? "client";
      const { id } = c.req.valid("param");
      const ctx = c.get("legalEntityContext") as LegalEntityContext | undefined;
      const result = await container.paymentService.markCapturedByAdmin(
        role,
        id,
        ctx?.legalEntityId,
      );
      return result.match(
        () => c.json({ ok: true }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/:id/refund",
    requireAuth,
    requireContext,
    requireFinanceEntityWrite,
    zValidator("param", paymentIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = c.get("userRole") ?? "client";
      const { id } = c.req.valid("param");
      const ctx = c.get("legalEntityContext") as LegalEntityContext | undefined;
      const result = await container.paymentService.refundPayment(
        userId,
        role,
        id,
        ctx?.legalEntityId,
      );
      return result.match(
        () => c.json({ ok: true }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  return r;
}
