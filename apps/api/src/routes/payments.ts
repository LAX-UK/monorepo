import {
  createPaymentBodySchema,
  myPaymentsQuerySchema,
  paymentIdParamSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Container } from "../container.js";
import { AuthzError, PaymentProviderError } from "../lib/errors.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import { requireFinanceEntityWrite } from "../middleware/require-capability.js";
import { createOptionalLegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { presentMyPayments } from "./payment-me-presenter.js";

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

  /** Buyer-facing payments list. Strictly scoped to the JWT user; the route never
   * accepts a buyerId from the client. Optional `?status` narrows the result.
   */
  r.get("/me", requireAuth, zValidator("query", myPaymentsQuerySchema), async (c) => {
    const userId = c.get("userId") as string;
    const { status } = c.req.valid("query");
    const all = await container.paymentService.listForBuyer(userId);
    const filtered = status ? all.filter((p) => p.status === status) : all;
    const lotIds = Array.from(new Set(filtered.map((p) => p.lotId)));
    const lots = await Promise.all(lotIds.map((id) => container.lotService.getById(id)));
    const lotById = new Map<string, NonNullable<(typeof lots)[number]>>();
    for (const lot of lots) {
      if (lot) lotById.set(lot.id, lot);
    }
    const data = await presentMyPayments(filtered, lotById, container.mediaUrlResolver);
    return c.json({ data });
  });

  /** Buyer relinquishes an unpaid pending invoice (winner-only). */
  r.post(
    "/me/:id/cancel-pending",
    requireAuth,
    requireBuyerRole,
    zValidator("param", paymentIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const result = await container.paymentService.cancelPendingAsBuyer(userId, id);
      return result.match(
        () => c.json({ ok: true }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

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
      const userId = c.get("userId") as string;
      const role = c.get("userRole") ?? "client";
      const { id } = c.req.valid("param");
      const ctx = c.get("legalEntityContext") as LegalEntityContext | undefined;
      const result = await container.paymentService.markCapturedByAdmin(
        userId,
        role,
        id,
        ctx?.legalEntityId,
      );
      return result.match(
        () => c.json({ ok: true }),
        (error: AuthzError | PaymentProviderError) => {
          if (error instanceof PaymentProviderError) {
            return c.json(
              { error: error.message, stripe_code: error.stripeCode ?? null },
              error.status as ContentfulStatusCode,
            );
          }
          if (error instanceof AuthzError) {
            return c.json({ error: error.message }, asHttpStatus(error.status));
          }
          throw error;
        },
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
        (error: AuthzError | PaymentProviderError) => {
          if (error instanceof PaymentProviderError) {
            return c.json(
              { error: error.message, stripe_code: error.stripeCode ?? null },
              error.status as ContentfulStatusCode,
            );
          }
          if (error instanceof AuthzError) {
            return c.json({ error: error.message }, asHttpStatus(error.status));
          }
          throw error;
        },
      );
    },
  );

  return r;
}
