import {
  adminDisputeAllocationBodySchema,
  adminDisputeCaseIdParamSchema,
  adminDisputeDeskListQuerySchema,
} from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import { requireDisputeAllocationWrite } from "../../middleware/require-capability.js";
import { DISPUTE_ALLOCATION_REFUSALS } from "../../services/disputes/dispute-allocation-refusals.js";
import type { AdminDisputeDeskRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono, AdminStaffMutationGuards } from "./_shared.js";

/**
 * The Disputes screen: cases to list and open (`finance.read`, applied to every `/finance/*`
 * route) and the allocation that moves seller payouts (platform finance write, a recent sign-in
 * and an Idempotency-Key).
 */
export function attachAdminDisputeDeskRoutes(
  finance: AdminHono,
  container: AdminDisputeDeskRoutesContainer,
  guards: AdminStaffMutationGuards,
): void {
  finance.get(
    "/finance/dispute-cases",
    zValidator("query", adminDisputeDeskListQuerySchema),
    async (c) => {
      const { limit, offset, view, q, reason } = c.req.valid("query");
      const page = await container.admin.disputeDesk.listCases({
        limit,
        offset,
        view,
        ...(q ? { q } : {}),
        ...(reason ? { reason } : {}),
      });
      return c.json({ data: page.rows, hasNextPage: page.hasNextPage, counts: page.counts });
    },
  );

  finance.get(
    "/finance/dispute-cases/:id",
    zValidator("param", adminDisputeCaseIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const found = await container.admin.disputeDesk.getCase(id);
      if (!found) return c.json({ error: "This dispute could not be found." }, 404);
      return c.json({ data: found });
    },
  );

  finance.post(
    "/finance/dispute-cases/:id/allocation",
    requireDisputeAllocationWrite,
    guards.requireStepUp,
    guards.idempotent("disputes.allocate"),
    zValidator("param", adminDisputeCaseIdParamSchema),
    zValidator("json", adminDisputeAllocationBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { expectedVersion, lines, note } = c.req.valid("json");
      const result = await container.admin.disputeDesk.allocate({
        caseId: id,
        expectedVersion,
        lines,
        note,
        actorUserId: c.get("userId") as string,
      });
      return result.match(
        (done) => c.json({ data: done }),
        (reason) => {
          const refusal = DISPUTE_ALLOCATION_REFUSALS[reason];
          return c.json({ error: refusal.message, code: reason }, refusal.status);
        },
      );
    },
  );
}
