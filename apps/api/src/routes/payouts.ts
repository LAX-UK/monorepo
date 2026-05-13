import {
  adminManualReversePayoutSchema,
  createPayoutAdjustmentSchema,
  listPayoutsQuerySchema,
  runSettlementSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requirePayoutProcess,
  requirePayoutRead,
  requirePayoutReverse,
} from "../middleware/require-capability.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import {
  PayoutNotFoundError,
  PayoutPermissionError,
  PayoutStatusTransitionError,
} from "../services/interfaces/payout.js";
import { ensureStatementQueued } from "./payout-statements.js";

const payoutIdParam = z.object({ payoutId: z.string().uuid() });
const RETRY_AFTER_SEC = 5;
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
export function createPayoutRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
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
      const list = await container.payoutService.listForLegalEntity(ctx.legalEntityId, {
        ...(q.status !== undefined ? { status: q.status } : {}),
        limit: q.limit,
        offset: q.offset,
      });
      return c.json({ data: list });
    },
  );

  /** GET /payouts/preview-next — pending payments not yet on a payout. */
  r.get("/preview-next", requireAuth, requireContext, async (c) => {
    const ctx = c.get("legalEntityContext") as LegalEntityContext;
    const preview = await container.payoutService.previewPending(ctx.legalEntityId);
    return c.json({ data: preview });
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
      try {
        const result = await container.payoutService.getById(ctx.legalEntityId, payoutId);
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

/** Admin payout routes (`payout.read` list, `payout.process` mutations). */
export function createAdminPayoutRoutes(container: Container, authenticator: IAuthenticator) {
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
      const p = await container.payoutRepository.findById(payoutId);
      if (!p) {
        return c.json({ error: "payout_not_found" }, 404);
      }
      if (p.statementGenerationError) {
        return c.json(
          { error: "statement_generation_failed", detail: p.statementGenerationError },
          422,
        );
      }
      if (p.statementUrl) {
        return c.redirect(p.statementUrl, 302);
      }
      await ensureStatementQueued(
        container.payoutRepository,
        container.payoutStatementQueue,
        payoutId,
      );
      return c.json({ error: "statement_pending" }, 503, {
        "Retry-After": String(RETRY_AFTER_SEC),
      });
    },
  );

  /** GET /admin/payouts — list across all entities (`payout.read`). */
  r.get("/", requireAuth, adminRead, zValidator("query", listPayoutsQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const list = await container.payoutService.adminList({
      ...(q.legalEntityId !== undefined ? { legalEntityId: q.legalEntityId } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      limit: q.limit,
      offset: q.offset,
    });
    return c.json({ data: list });
  });

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
      const result = await container.payoutService.createSettlement(userId, {
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
        const result = await container.payoutService.addAdjustment(userId, payoutId, body);
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
        const result = await container.payoutService.markPaid(userId, payoutId, body);
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
        const result = await container.payoutService.adminManualReverse(userId, payoutId, {
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
