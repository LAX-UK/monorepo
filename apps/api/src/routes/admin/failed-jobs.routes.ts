import {
  adminFailedJobIdParamSchema,
  adminFailedJobsDiscardBodySchema,
  adminFailedJobsQuerySchema,
  adminFailedJobsRestoreBodySchema,
  adminFailedJobsRetryBodySchema,
} from "@auction/validators";
import type { ContainerAdminPlatformRoutesSlice } from "../../container.js";
import { actorFromContext } from "../../lib/admin-actor-context.js";
import { createBaseLogger } from "../../lib/logger.js";
import { zValidator } from "../../lib/z-validator.js";
import { createAuditAccessMiddleware } from "../../middleware/audit-access.js";
import {
  requireFailedJobsAnySourceAct,
  requireFailedJobsAnySourceRead,
} from "../../middleware/require-capability.js";
import type { AdminHono } from "./_shared.js";

/**
 * Failures from every source (background jobs, Xero, Zoho, inbound webhooks), for the people who
 * keep the platform running. The routes let in anyone who may work with at least one source; the
 * service then narrows what each person sees and changes to the sources their roles cover.
 * Retrying, discarding and restoring are each written to the audit log. Payloads are masked
 * before they leave the server, and a decision on several jobs reports each job's outcome.
 */
export function attachAdminFailedJobsRoutes(
  platform: AdminHono,
  container: ContainerAdminPlatformRoutesSlice,
): void {
  const auditAccess = createAuditAccessMiddleware(createBaseLogger(container.env));
  platform.use("/system/failed-jobs/*", auditAccess);
  platform.use("/system/failed-jobs", auditAccess);

  /** GET /admin/system/failed-jobs — a view of failed jobs with filters, counts and queue facets. */
  platform.get(
    "/system/failed-jobs",
    requireFailedJobsAnySourceRead,
    zValidator("query", adminFailedJobsQuerySchema),
    async (c) => {
      const data = await container.admin.failedJobs.list(c.req.valid("query"), actorFromContext(c));
      return c.json({ data });
    },
  );

  /** GET /admin/system/failed-jobs/:id — one job with its masked payload and history. */
  platform.get(
    "/system/failed-jobs/:id",
    requireFailedJobsAnySourceRead,
    zValidator("param", adminFailedJobIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const data = await container.admin.failedJobs.detail(id, actorFromContext(c));
      if (!data) return c.json({ error: "job_not_found" }, 404);
      return c.json({ data });
    },
  );

  /** POST /admin/system/failed-jobs/retry — run jobs again; `confirmRepeat` ticks the repeat warning. */
  platform.post(
    "/system/failed-jobs/retry",
    requireFailedJobsAnySourceAct,
    zValidator("json", adminFailedJobsRetryBodySchema),
    async (c) => {
      const { ids, confirmRepeat } = c.req.valid("json");
      const data = await container.admin.failedJobs.retry(ids, confirmRepeat, actorFromContext(c));
      return c.json({ data });
    },
  );

  /** POST /admin/system/failed-jobs/discard — set jobs aside with a reason. */
  platform.post(
    "/system/failed-jobs/discard",
    requireFailedJobsAnySourceAct,
    zValidator("json", adminFailedJobsDiscardBodySchema),
    async (c) => {
      const { ids, reason, note } = c.req.valid("json");
      const data = await container.admin.failedJobs.discard(ids, reason, note, actorFromContext(c));
      return c.json({ data });
    },
  );

  /** POST /admin/system/failed-jobs/restore — put discarded jobs back in review. */
  platform.post(
    "/system/failed-jobs/restore",
    requireFailedJobsAnySourceAct,
    zValidator("json", adminFailedJobsRestoreBodySchema),
    async (c) => {
      const { ids } = c.req.valid("json");
      const data = await container.admin.failedJobs.restore(ids, actorFromContext(c));
      return c.json({ data });
    },
  );
}
