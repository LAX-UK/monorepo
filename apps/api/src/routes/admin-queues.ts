import {
  adminQueueDlqJobIdParamSchema,
  adminQueueJobIdParamSchema,
  adminQueueJobsQuerySchema,
  adminQueueNameParamSchema,
  adminQueueReplayDlqBodySchema,
} from "@auction/validators";
import type { Hono } from "hono";
import type { Container } from "../container.js";
import {
  mapPauseError,
  mapReplayError,
  mapResumeError,
  mapRetryError,
} from "../lib/admin-queue-errors.js";
import { createBaseLogger } from "../lib/logger.js";
import { zValidator } from "../lib/z-validator.js";
import { createAuditAccessMiddleware } from "../middleware/audit-access.js";
import { requireSuperAdminStaffRole } from "../middleware/require-staff-role.js";
import type { ActorContext } from "../services/interfaces/queue-inspector.js";

function actorFromContext(c: {
  get: (key: "userId" | "userStaffRole") => string | null | undefined;
  req: { header: (name: string) => string | undefined };
}): ActorContext {
  const requestId = c.req.header("x-request-id");
  return {
    userId: c.get("userId") as string,
    staffRole: (c.get("userStaffRole") as string | null | undefined) ?? null,
    ...(requestId !== undefined ? { requestId } : {}),
  };
}

export function attachAdminQueuesRoutes(
  platform: Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>,
  container: Container,
) {
  const auditAccess = createAuditAccessMiddleware(createBaseLogger(container.env));
  platform.use("/system/job-queues", requireSuperAdminStaffRole);
  platform.use("/system/job-queues/*", requireSuperAdminStaffRole);
  platform.use("/system/job-queues", auditAccess);
  platform.use("/system/job-queues/*", auditAccess);

  platform.get("/system/job-queues", async (c) => {
    const data = await container.queueAdmin.inspector.list();
    return c.json({ data });
  });

  platform.get(
    "/system/job-queues/:name/jobs",
    zValidator("param", adminQueueNameParamSchema),
    zValidator("query", adminQueueJobsQuerySchema),
    async (c) => {
      const { name } = c.req.valid("param");
      const { status, offset, limit } = c.req.valid("query");
      const data = await container.queueAdmin.inspector.jobs(name, status, { offset, limit });
      return c.json({ data });
    },
  );

  platform.get(
    "/system/job-queues/:name/jobs/:jobId",
    zValidator("param", adminQueueJobIdParamSchema),
    async (c) => {
      const { name, jobId } = c.req.valid("param");
      const job = await container.queueAdmin.inspector.job(name, jobId);
      if (!job) return c.json({ error: "job_not_found" }, 404);
      return c.json({ data: job });
    },
  );

  platform.post(
    "/system/job-queues/:name/jobs/:jobId/retry",
    zValidator("param", adminQueueJobIdParamSchema),
    async (c) => {
      const { name, jobId } = c.req.valid("param");
      try {
        await container.queueAdmin.mutator.retry(name, jobId, actorFromContext(c));
        return c.json({ ok: true });
      } catch (err) {
        const { error, status } = mapRetryError(err);
        return c.json({ error }, status);
      }
    },
  );

  platform.post(
    "/system/job-queues/:name/pause",
    zValidator("param", adminQueueNameParamSchema),
    async (c) => {
      const { name } = c.req.valid("param");
      try {
        await container.queueAdmin.mutator.pause(name, actorFromContext(c));
        return c.json({ ok: true });
      } catch (err) {
        const { error, status } = mapPauseError(err);
        return c.json({ error }, status);
      }
    },
  );

  platform.post(
    "/system/job-queues/:name/resume",
    zValidator("param", adminQueueNameParamSchema),
    async (c) => {
      const { name } = c.req.valid("param");
      try {
        await container.queueAdmin.mutator.resume(name, actorFromContext(c));
        return c.json({ ok: true });
      } catch (err) {
        const { error, status } = mapResumeError(err);
        return c.json({ error }, status);
      }
    },
  );

  platform.post(
    "/system/job-queues/dead-letter/:jobId/replay",
    zValidator("param", adminQueueDlqJobIdParamSchema),
    zValidator("json", adminQueueReplayDlqBodySchema),
    async (c) => {
      const { jobId } = c.req.valid("param");
      const body = c.req.valid("json");
      try {
        await container.queueAdmin.mutator.replayFromDlq(
          jobId,
          actorFromContext(c),
          body.confirmIdempotency,
        );
        return c.json({ ok: true });
      } catch (err) {
        const { error, status } = mapReplayError(err);
        return c.json({ error }, status);
      }
    },
  );
}
