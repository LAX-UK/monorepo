import {
  adminManualReversePayoutSchema,
  createPayoutAdjustmentSchema,
  listPayoutsQuerySchema,
  runSettlementSchema,
} from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import type { ContainerPayoutRoutesSlice } from "../container.js";
import { respondFinanceRouteOutcome } from "../lib/finance-route-response.js";
import { mapPayoutStatementOutcomeToHttp } from "../lib/payout-statement-http.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requirePayoutProcess,
  requirePayoutRead,
  requirePayoutReverse,
} from "../middleware/require-capability.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { AdminFinancePayoutRoutesContainer } from "../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import {
  PayoutNotFoundError,
  PayoutPermissionError,
  PayoutStatusTransitionError,
} from "../services/interfaces/payout.js";
const payoutIdParam = z.object({ payoutId: z.string().uuid() });
const settlementPreviewQuery = z.object({ legalEntityId: z.string().uuid() });
const markPaidBodySchema = z.object({
  stripeTransferId: z.string().min(3).max(200),
});

function handleError(err: unknown) {
  if (err instanceof PayoutNotFoundError) return { status: 404 as const, code: err.code };
  if (err instanceof PayoutPermissionError) return { status: 403 as const, code: err.code };
  if (err instanceof PayoutStatusTransitionError) return { status: 409 as const, code: err.code };
  return null;
}

/** Seller-side routes scoped to the acting legal entity. All require both
 * authentication and a valid `X-Legal-Entity-Id` header.
 */
export function createPayoutRoutes(
  container: ContainerPayoutRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const sellerPayoutHttp = container.finance.sellerPayoutHttp;
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      legalEntityContext?: LegalEntityContext;
    };
  }>();

  /** GET /payouts — list payouts for the acting entity. */
  r.get(
    "/",
    requireAuth,
    requireContext,
    zValidator("query", listPayoutsQuerySchema),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const q = c.req.valid("query");
      const outcome = await sellerPayoutHttp.listForLegalEntity(ctx.legalEntityId, {
        ...(q.status !== undefined ? { status: q.status } : {}),
        limit: q.limit,
        offset: q.offset,
      });
      return respondFinanceRouteOutcome(c, outcome);
    },
  );

  /** GET /payouts/preview-next — pending payments not yet on a payout. */
  r.get("/preview-next", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const outcome = await sellerPayoutHttp.previewPending(ctx.legalEntityId);
    return respondFinanceRouteOutcome(c, outcome);
  });

  /** GET /payouts/:payoutId — full payout + lines (entity-scoped). */
  r.get(
    "/:payoutId",
    requireAuth,
    requireContext,
    zValidator("param", payoutIdParam),
    async (c) => {
      const ctx = c.get("legalEntityContext") as LegalEntityContext;
      const { payoutId } = c.req.valid("param");
      const outcome = await sellerPayoutHttp.getById(ctx.legalEntityId, payoutId);
      return respondFinanceRouteOutcome(c, outcome);
    },
  );

  return r;
}

/** Admin payout routes (`payout.read` list, `payout.process` mutations). */
export function createAdminPayoutRoutes(
  container: AdminFinancePayoutRoutesContainer,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();
  const adminRead = requirePayoutRead;
  const adminMutate = requirePayoutProcess;
  const adminReverse = requirePayoutReverse;

  /** GET /admin/payouts/:payoutId/statement.pdf — lazy PDF via worker (`payout.read`). */
  r.get(
    "/:payoutId/statement.pdf",
    requireAuth,
    adminRead,
    zValidator("param", payoutIdParam),
    async (c) => {
      const { payoutId } = c.req.valid("param");
      const outcome = await container.admin.payouts.resolveStatementPdf(payoutId);
      return mapPayoutStatementOutcomeToHttp(c, outcome);
    },
  );

  /** GET /admin/payouts — paginated list with filtered summary (`payout.read`). */
  r.get("/", requireAuth, adminRead, zValidator("query", listPayoutsQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const page = await container.admin.payouts.adminListPage({
      ...(q.legalEntityId !== undefined ? { legalEntityId: q.legalEntityId } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      limit: q.limit,
      offset: q.offset,
    });
    return c.json({
      data: page.rows,
      meta: {
        total: page.total,
        limit: page.limit,
        offset: page.offset,
        summary: page.summary,
      },
    });
  });

  /** GET /admin/payouts/settlement-preview — pending settlement snapshot for one entity. */
  r.get(
    "/settlement-preview",
    requireAuth,
    adminRead,
    zValidator("query", settlementPreviewQuery),
    async (c) => {
      const { legalEntityId } = c.req.valid("query");
      const preview = await container.admin.payouts.adminSettlementPreview(legalEntityId);
      return c.json({ data: preview });
    },
  );

  /** POST /admin/payouts/run-settlement — create a payout from pending payments. */
  r.post(
    "/run-settlement",
    requireAuth,
    adminMutate,
    zValidator("json", runSettlementSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      if (!body.legalEntityId) {
        return c.json({ error: "legal_entity_id_required_until_bulk_implemented" }, 400);
      }
      const result = await container.admin.payouts.createSettlement(userId, {
        legalEntityId: body.legalEntityId,
        periodStart: new Date(0),
        periodEnd: new Date(),
      });
      if (!result.ok) return c.json({ error: result.reason }, 409);
      return c.json({ data: result.payout }, 201);
    },
  );

  /** POST /admin/payouts/:payoutId/adjustments — append manual line. */
  r.post(
    "/:payoutId/adjustments",
    requireAuth,
    adminMutate,
    zValidator("param", payoutIdParam),
    zValidator("json", createPayoutAdjustmentSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { payoutId } = c.req.valid("param");
      const body = c.req.valid("json");
      try {
        const result = await container.admin.payouts.addAdjustment(userId, payoutId, body);
        return c.json({ data: result }, 201);
      } catch (err) {
        const mapped = handleError(err);
        if (mapped) return c.json({ error: mapped.code }, mapped.status);
        throw err;
      }
    },
  );

  /** POST /admin/payouts/:payoutId/mark-paid — transition to paid. */
  r.post(
    "/:payoutId/mark-paid",
    requireAuth,
    adminMutate,
    zValidator("param", payoutIdParam),
    zValidator("json", markPaidBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { payoutId } = c.req.valid("param");
      const body = c.req.valid("json");
      try {
        const result = await container.admin.payouts.markPaid(userId, payoutId, body);
        return c.json({ data: result });
      } catch (err) {
        const mapped = handleError(err);
        if (mapped) return c.json({ error: mapped.code }, mapped.status);
        throw err;
      }
    },
  );

  /** POST /admin/payouts/:payoutId/reverse — manual reversal bookkeeping (administrator). */
  r.post(
    "/:payoutId/reverse",
    requireAuth,
    adminReverse,
    zValidator("param", payoutIdParam),
    zValidator("json", adminManualReversePayoutSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { payoutId } = c.req.valid("param");
      const body = c.req.valid("json");
      const expected = `REVERSE PAYOUT ${payoutId}`;
      if (body.confirmationPhrase !== expected) {
        return c.json(
          {
            error: "confirmation_mismatch",
            message: `Type exactly: ${expected}`,
          },
          400,
        );
      }
      try {
        const result = await container.admin.payouts.adminManualReverse(userId, payoutId, {
          reason: body.reason,
        });
        return c.json({ data: result });
      } catch (err) {
        const mapped = handleError(err);
        if (mapped) return c.json({ error: mapped.code }, mapped.status);
        throw err;
      }
    },
  );

  return r;
}
