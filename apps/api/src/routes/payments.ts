import {
  adminLotFulfilmentLotIdParamSchema,
  createPaymentBodySchema,
  myPaymentsQuerySchema,
  paymentIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { LotError, PaymentProviderError } from "../lib/errors.js";
import { asHttpStatus } from "../lib/http-status.js";
import { buildWebsiteUserEvent } from "../lib/marketing-event-factory.js";
import { paymentCommandErrorToHttp } from "../lib/payment-http-error.js";
import { zValidator } from "../lib/z-validator.js";
import type { MarketingClientContextVars } from "../middleware/marketing-client-context.js";
import type { MarketingConsentVars } from "../middleware/marketing-consent.js";
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
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRole?: string | null;
      legalEntityContext?: LegalEntityContext;
    } & MarketingConsentVars &
      MarketingClientContextVars;
  }>();

  r.get("/", requireAuth, async (c) => {
    const role = c.get("userRole") ?? "client";
    const staffRole = c.get("userStaffRole") ?? null;
    const result = await container.paymentService.listAllForAdmin(role, staffRole);
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
    const { data } = await container.paymentService.listMyPaymentsForBuyerApi(userId, {
      ...(status !== undefined ? { status } : {}),
    });
    return c.json({ data });
  });

  /** Winning bidder: fulfilment row for checkout / collection tracking. */
  r.get(
    "/me/lot/:lotId/fulfilment",
    requireAuth,
    requireBuyerRole,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { lotId } = c.req.valid("param");
      const result = await container.lotFulfilmentService.getForWinner(userId, lotId);
      return result.match(
        (data) => c.json({ data }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

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
      const result = await container.paymentService.createPendingForWinner(
        userId,
        body.lotId,
        body.addressId,
      );
      if (result.isErr()) {
        const error = result.error;
        const body: Record<string, string> = { error: error.message };
        if (error instanceof PaymentProviderError && error.stripeCode) {
          body.code = error.stripeCode;
        } else if (error instanceof LotError && error.code) {
          body.code = error.code;
        }
        return c.json(body, asHttpStatus(error.status));
      }
      const data = result.value;
      const marketingEventId = crypto.randomUUID();
      await container.marketingEventService.emit(
        buildWebsiteUserEvent(c, {
          name: "InitiateCheckout",
          eventId: marketingEventId,
          userId,
          customData: { lotId: body.lotId, paymentId: data.paymentId },
        }),
      );
      return c.json(
        {
          data: {
            paymentId: data.paymentId,
            checkoutUrl: data.checkoutUrl,
            checkoutRail: data.checkoutRail,
            manualReviewReason: data.manualReviewReason,
            marketingEventId,
          },
        },
        201,
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
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const ctx = c.get("legalEntityContext") as LegalEntityContext | undefined;
      const result = await container.paymentService.markCapturedByAdmin(
        userId,
        role,
        id,
        ctx?.legalEntityId,
        staffRole,
      );
      return result.match(
        () => c.json({ ok: true }),
        (error) => {
          const mapped = paymentCommandErrorToHttp(error);
          return c.json(mapped.body, mapped.status);
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
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const ctx = c.get("legalEntityContext") as LegalEntityContext | undefined;
      const result = await container.paymentService.refundPayment(
        userId,
        role,
        id,
        ctx?.legalEntityId,
        staffRole,
      );
      return result.match(
        () => c.json({ ok: true }),
        (error) => {
          const mapped = paymentCommandErrorToHttp(error);
          return c.json(mapped.body, mapped.status);
        },
      );
    },
  );

  return r;
}
