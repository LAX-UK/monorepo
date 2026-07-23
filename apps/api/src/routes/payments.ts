import {
  adminLotFulfilmentLotIdParamSchema,
  createPaymentBodySchema,
  myPaymentsQuerySchema,
  paymentIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import type { ContainerPaymentHttpRoutesSlice } from "../container.js";
import {
  respondFinanceError,
  respondFinanceOkBody,
  respondFinanceRouteOutcome,
} from "../lib/finance-route-response.js";
import { asHttpStatus } from "../lib/http-status.js";
import { marketingWebsiteContextFromHono } from "../lib/marketing-website-context.js";
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

const sourceOfFundsCaseIdParamSchema = z.object({ id: z.string().uuid() });

const attachSofDocumentBodySchema = z.object({
  uploadObjectId: z.string().uuid(),
  requestedType: z.string().min(1).max(500),
  label: z.string().max(500).optional(),
});

export function createPaymentRoutes(
  container: ContainerPaymentHttpRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = createOptionalLegalEntityContext(
    container.legalEntityRepository,
    (input) => container.impersonationAuditService.recordSessionTimedOut(input),
    container.impersonationSessionService,
  );
  const buyerPaymentHttp = container.finance.buyerPaymentHttp;
  const entityStaffPayment = container.finance.entityStaffPayment;

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
    const result = await entityStaffPayment.listAllForAdmin(role, staffRole);
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  r.get("/me/compliance-gate", requireAuth, requireBuyerRole, async (c) => {
    const userId = c.get("userId") as string;
    const outcome = await buyerPaymentHttp.getBuyerComplianceGate(userId);
    return respondFinanceRouteOutcome(c, outcome);
  });

  r.get("/me/source-of-funds", requireAuth, requireBuyerRole, async (c) => {
    const userId = c.get("userId") as string;
    const outcome = await buyerPaymentHttp.getBuyerSourceOfFundsView(userId);
    return respondFinanceRouteOutcome(c, outcome);
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
      const result = await buyerPaymentHttp.attachSourceOfFundsDocument({
        buyerUserId: userId,
        caseId,
        uploadObjectId,
        requestedType,
        label: label ?? null,
      });
      if (!result.ok) {
        const body: Record<string, string> = { error: result.error };
        if (result.error === "rate_limited") body.code = "rate_limited";
        return c.json(body, asHttpStatus(result.status));
      }
      return c.json({ ok: true, document: result.document });
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
      const result = await buyerPaymentHttp.submitSourceOfFundsDocuments({
        buyerUserId: userId,
        caseId,
      });
      if (!result.ok) {
        return c.json({ error: result.error }, asHttpStatus(result.status));
      }
      return c.json({ ok: true, sourceOfFunds: result.sourceOfFunds });
    },
  );

  r.get("/me", requireAuth, zValidator("query", myPaymentsQuerySchema), async (c) => {
    const userId = c.get("userId") as string;
    const { status } = c.req.valid("query");
    const outcome = await buyerPaymentHttp.listMyPayments(userId, {
      ...(status !== undefined ? { status } : {}),
    });
    return respondFinanceRouteOutcome(c, outcome);
  });

  r.get(
    "/me/lot/:lotId/fulfilment",
    requireAuth,
    requireBuyerRole,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { lotId } = c.req.valid("param");
      const outcome = await buyerPaymentHttp.getWinnerLotFulfilment(userId, lotId);
      if (outcome.kind === "err") {
        const body: Record<string, string> = { error: outcome.error.message };
        if (outcome.error.code) body.code = outcome.error.code;
        return c.json(body, asHttpStatus(outcome.error.status));
      }
      return c.json({ data: outcome.data });
    },
  );

  r.post(
    "/me/:id/cancel-pending",
    requireAuth,
    requireBuyerRole,
    zValidator("param", paymentIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const outcome = await buyerPaymentHttp.cancelPendingPayment(userId, id);
      if (outcome.kind === "ok") return c.json({ ok: true });
      return respondFinanceError(c, outcome.error);
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
      const result = await buyerPaymentHttp.initiateBuyerCheckout({
        buyerUserId: userId,
        lotId: body.lotId,
        addressId: body.addressId,
        websiteContext: marketingWebsiteContextFromHono(c),
      });
      if (!result.ok) {
        const errBody: Record<string, string> = { error: result.error };
        if (result.code) errBody.code = result.code;
        return c.json(errBody, asHttpStatus(result.status));
      }
      return respondFinanceOkBody(c, { data: result.data }, result.status);
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
      const result = await entityStaffPayment.markCapturedByAdmin(
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
      const result = await entityStaffPayment.refundPayment(
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
