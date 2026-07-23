import { Hono } from "hono";
import { z } from "zod";
import type { ContainerPayoutStatementRoutesSlice } from "../container.js";
import { mapPayoutStatementOutcomeToHttp } from "../lib/payout-statement-http.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const statementParams = z.object({
  legalEntityId: z.string().uuid(),
  payoutId: z.string().uuid(),
});

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
      const outcome = await container.finance.payoutStatement.resolveForLegalEntityMember({
        userId,
        legalEntityId,
        payoutId,
      });
      return mapPayoutStatementOutcomeToHttp(c, outcome, "payout_not_found");
    },
  );

  return r;
}
