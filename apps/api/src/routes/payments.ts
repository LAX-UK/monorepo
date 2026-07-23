import {
  adminLotFulfilmentLotIdParamSchema,
  createPaymentBodySchema,
  myPaymentsQuerySchema,
  paymentIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { LotError, PaymentProviderError } from "../lib/errors.js";
import { asHttpStatus } from "../lib/http-status.js";
import { buildEnrichedWebsiteUserEvent } from "../lib/marketing-attribution-context.js";
import { paymentCommandErrorToHttp } from "../lib/payment-http-error.js";
import { checkSofDocumentAttachRateLimit } from "../lib/sof-document-attach-rate-limit.js";
import { zValidator } from "../lib/z-validator.js";
import type { MarketingClientContextVars } from "../middleware/marketing-client-context.js";
import type { MarketingConsentVars } from "../middleware/marketing-consent.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import { requireFinanceEntityWrite } from "../middleware/require-capability.js";
import { createOptionalLegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const sourceOfFundsCaseIdParamSchema = z.object({ id: z.string().uuid() });

const attachSofDocumentBodySchema = z.object({
  uploadObjectId: z.string().uuid(),
  requestedType: z.string().min(1).max(500),
  label: z.string().max(500).optional(),
});

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

  /** Buyer pre-flight compliance gate: checks AML hold + SoF without creating
   * a payment row. Used by the checkout page and portfolio to surface blockers
   * before the buyer submits. */
  r.get("/me/compliance-gate", requireAuth, requireBuyerRole, async (c) => {
    const userId = c.get("userId") as string;
    const result = await container.paymentService.getBuyerComplianceGateStatus(userId);
    return c.json({ data: result });
  });

  /** Buyer Source-of-Funds case + document upload status. */
  r.get("/me/source-of-funds", requireAuth, requireBuyerRole, async (c) => {
    const userId = c.get("userId") as string;
    const view = await container.sourceOfFundsDocumentCollectionService.getBuyerView(userId);
    return c.json({ data: view });
  });

  r.post(
    "/me/source-of-funds/:id/documents",
    requireAuth,
    requireBuyerRole,
    zValidator("param", sourceOfFundsCaseIdParamSchema),
    zValidator("json", attachSofDocumentBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id: caseId } = c.req.valid("param");
      const { uploadObjectId, requestedType, label } = c.req.valid("json");
      const allowed = await checkSofDocumentAttachRateLimit(container.redis, userId);
      if (!allowed) {
        return c.json({ error: "Too many upload attempts", code: "rate_limited" }, 429);
      }
      try {
        const doc = await container.sourceOfFundsDocumentCollectionService.attachDocument({
          caseId,
          buyerUserId: userId,
          uploadObjectId,
          requestedType,
          label: label ?? null,
        });
        return c.json({ ok: true, document: doc });
      } catch (err) {
        const message = err instanceof Error ? err.message : "attach_failed";
        if (message === "source_of_funds_not_found") return c.json({ error: message }, 404);
        if (message === "source_of_funds_forbidden") return c.json({ error: message }, 403);
        if (
          message === "source_of_funds_documents_not_requested" ||
          message === "source_of_funds_documents_already_submitted" ||
          message === "source_of_funds_not_pending"
        ) {
          return c.json({ error: message }, 409);
        }
        if (
          message === "upload_not_active" ||
          message === "upload_kind_mismatch" ||
          message === "source_of_funds_requested_type_not_allowed"
        ) {
          return c.json({ error: message }, 400);
        }
        throw err;
      }
    },
  );

  r.post(
    "/me/source-of-funds/:id/documents/submit",
    requireAuth,
    requireBuyerRole,
    zValidator("param", sourceOfFundsCaseIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id: caseId } = c.req.valid("param");
      try {
        const record = await container.sourceOfFundsDocumentCollectionService.submitDocuments({
          caseId,
          buyerUserId: userId,
        });
        return c.json({ ok: true, sourceOfFunds: record });
      } catch (err) {
        const message = err instanceof Error ? err.message : "submit_failed";
        if (message === "source_of_funds_not_found") return c.json({ error: message }, 404);
        if (message === "source_of_funds_forbidden") return c.json({ error: message }, 403);
        if (
          message === "source_of_funds_documents_not_requested" ||
          message === "source_of_funds_documents_already_submitted" ||
          message === "source_of_funds_no_documents_to_submit"
        ) {
          return c.json({ error: message }, 409);
        }
        throw err;
      }
    },
  );

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
        await buildEnrichedWebsiteUserEvent(
          c,
          {
            name: "InitiateCheckout",
            eventId: marketingEventId,
            userId,
            customData: { lotId: body.lotId, paymentId: data.paymentId },
          },
          {
            attributionEnabled: container.marketingAttributionEnabled,
            attributionStore: container.attributionStore,
          },
        ),
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
