import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { Queue } from "bullmq";
import { Hono } from "hono";
import { z } from "zod";
import type { ContainerPayoutStatementRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const statementParams = z.object({
  legalEntityId: z.string().uuid(),
  payoutId: z.string().uuid(),
});

const STATEMENT_ROLES = new Set(["owner", "admin", "finance"]);

const RETRY_AFTER_SEC = 5;

export async function ensureStatementQueued(
  payoutRepo: IPayoutRepository,
  queue: Queue<{ payoutId: string }>,
  payoutId: string,
): Promise<void> {
  await payoutRepo.clearStatementGenerationError(payoutId);
  await queue.add(
    "generate-payout-statement",
    { payoutId },
    {
      jobId: `payout-statement:${payoutId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 4000 },
      removeOnComplete: 50,
    },
  );
}

/** GET /legal-entities/:legalEntityId/payouts/:payoutId/statement.pdf
 * Mirrors dashboard URL shape; lazy-generates via BullMQ worker + Spaces.
 */
export function createLegalEntityPayoutStatementRoutes(
  container: ContainerPayoutStatementRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.get(
    "/:legalEntityId/payouts/:payoutId/statement.pdf",
    requireAuth,
    zValidator("param", statementParams),
    async (c) => {
      const userId = c.get("userId") as string;
      const { legalEntityId, payoutId } = c.req.valid("param");

      const membership = await container.legalEntityRepository.findActiveMembership(
        userId,
        legalEntityId,
      );
      if (!membership) {
        return c.json({ error: "not_a_member_of_legal_entity" }, 403);
      }
      if (!STATEMENT_ROLES.has(membership.role)) {
        return c.json({ error: "insufficient_role_for_statement" }, 403);
      }

      const p = await container.payoutRepository.findById(payoutId);
      if (!p || p.legalEntityId !== legalEntityId) {
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

  return r;
}
