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
  requireFailedJobsRead,
  requireFailedJobsWrite,
} from "../../middleware/require-capability.js";
import type { AdminHono } from "./_shared.js";

/**
 * Failed background jobs, for the people who keep the platform running. Reading is open to
 * administrators and read-only staff; retrying, discarding and restoring are administrators'
 * decisions and each is written to the audit log. Payloads are masked before they leave the
 * server, and a decision on several jobs reports each job's outcome.
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
    requireFailedJobsRead,
    zValidator("query", adminFailedJobsQuerySchema),
    async (c) => {
      const data = await container.admin.failedJobs.list(c.req.valid("query"));
      return c.json({ data });
    },
  );

  /** GET /admin/system/failed-jobs/:id — one job with its masked payload and history. */
  platform.get(
    "/system/failed-jobs/:id",
    requireFailedJobsRead,
    zValidator("param", adminFailedJobIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const data = await container.admin.failedJobs.detail(id);
      if (!data) return c.json({ error: "job_not_found" }, 404);
      return c.json({ data });
    },
  );

  /** POST /admin/system/failed-jobs/retry — run jobs again; `confirmRepeat` ticks the repeat warning. */
  platform.post(
    "/system/failed-jobs/retry",
    requireFailedJobsWrite,
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
    requireFailedJobsWrite,
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
    requireFailedJobsWrite,
    zValidator("json", adminFailedJobsRestoreBodySchema),
    async (c) => {
      const { ids } = c.req.valid("json");
      const data = await container.admin.failedJobs.restore(ids, actorFromContext(c));
      return c.json({ data });
    },
  );
}
