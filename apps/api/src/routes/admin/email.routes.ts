import {
  adminBulkEmailSuppressionsBodySchema,
  adminListEventsQuerySchema,
  adminListOutboxQuerySchema,
  adminListSuppressionsQuerySchema,
  emailHashParamSchema,
} from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireEmailAdmin,
  requireEmailObservability,
} from "../../middleware/require-capability.js";
import type { AdminCatalogSupportRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminEmailRoutes(
  platform: AdminHono,
  container: AdminCatalogSupportRoutesContainer,
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

  platform.delete(
    "/email/suppressions/:emailHash",
    requireEmailAdmin,
    zValidator("param", emailHashParamSchema),
    async (c) => {
      const { emailHash } = c.req.valid("param");
      await container.admin.email.deleteSuppression({ emailHash });
      return c.json({ ok: true });
    },
  );

  platform.post(
    "/email/suppressions/bulk",
    requireEmailAdmin,
    zValidator("json", adminBulkEmailSuppressionsBodySchema),
    async (c) => {
      const { emailHashes } = c.req.valid("json");
      const count = await container.admin.email.deleteSuppressionsBulk(emailHashes);
      return c.json({ ok: true, data: { count } });
    },
  );
}
