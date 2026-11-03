import {
  adminLiftEmailBlockBodySchema,
  adminListEventsQuerySchema,
  adminListOutboxQuerySchema,
  adminListSuppressionsQuerySchema,
  emailHashParamSchema,
} from "@auction/validators";
import { liftOutcomeResponse } from "../../lib/email-block-lift-response.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireEmailAdmin,
  requireEmailObservability,
} from "../../middleware/require-capability.js";
import type { AdminEmailRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminEmailRoutes(
  platform: AdminHono,
  container: AdminEmailRoutesContainer,
): void {
  platform.get(
    "/email/outbox",
    requireEmailObservability,
    zValidator("query", adminListOutboxQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.email.listOutbox({
        ...(q.status ? { status: q.status } : {}),
        limit: q.limit,
        offset: q.offset,
      });
      return c.json({ data });
    },
  );

  platform.get(
    "/email/events",
    requireEmailObservability,
    zValidator("query", adminListEventsQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.email.listEvents(q);
      return c.json({ data });
    },
  );

  platform.get(
    "/email/suppressions",
    requireEmailObservability,
    zValidator("query", adminListSuppressionsQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.email.listSuppressions(q);
      return c.json({ data });
    },
  );

  /**
   * DELETE /admin/email/suppressions/:emailHash — lifts a block by its address hash, under the
   * same rules, reason and audit as lifting it from the person's page.
   */
  platform.delete(
    "/email/suppressions/:emailHash",
    requireEmailAdmin,
    zValidator("param", emailHashParamSchema),
    zValidator("json", adminLiftEmailBlockBodySchema),
    async (c) => {
      const { emailHash } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await container.admin.emailBlockLift.lift({
        emailHash,
        actor: {
          userId: c.get("userId") as string,
          canLift: true,
          isEmailAdmin: true,
        },
        reason: body.reason,
        note: body.note,
        writtenRequest: body.writtenRequest,
        expectedSince: new Date(body.expectedSince),
      });
      return liftOutcomeResponse(c, outcome);
    },
  );
}
