import {
  adminAnalyticsQuerySchema,
  adminSetRoleBodySchema,
  adminSubmissionCountQuerySchema,
  adminSuspendBodySchema,
  adminUserListQuerySchema,
  userIdParamSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { Container } from "../container.js";
import { AuthzError } from "../lib/errors.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export function createAdminRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  const requireAdmin = createMiddleware<{
    Variables: { userId?: string; userRole?: string };
  }>(async (c, next) => {
    if (c.get("userRole") !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });

  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();
  r.use("*", requireAuth, requireAdmin);

  r.get(
    "/submissions/pending-count",
    zValidator("query", adminSubmissionCountQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const count = await container.itemSubmissionService.countPendingForAdmin({
        status: q.status,
      });
      return c.json({ data: { count } });
    },
  );

  r.get("/analytics", zValidator("query", adminAnalyticsQuerySchema), async (c) => {
    const { days } = c.req.valid("query");
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);
    const data = await container.analyticsService.getDashboard({ start, end });
    return c.json({ data });
  });

  r.get("/metrics/today", async (c) => {
    const data = await container.adminMetricsService.getTodaySnapshot();
    return c.json({ data });
  });

  r.get("/metrics/live", async (c) => {
    const bidsPerMinute = await container.adminMetricsService.getBidsPerMinute();
    return c.json({ data: { bidsPerMinute } });
  });

  r.get("/users", zValidator("query", adminUserListQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.adminUserService.list({
      q: q.q,
      limit: q.limit,
      offset: q.offset,
    });
    return c.json({ data });
  });

  r.get("/users/:userId", zValidator("param", userIdParamSchema), async (c) => {
    const { userId } = c.req.valid("param");
    const row = await container.adminUserService.getById(userId);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ data: row });
  });

  r.patch(
    "/users/:userId/role",
    zValidator("param", userIdParamSchema),
    zValidator("json", adminSetRoleBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { role } = c.req.valid("json");
      const actorRole = c.get("userRole") ?? "user";
      const actorId = c.get("userId") as string;
      try {
        await container.adminUserService.setRole(actorRole, actorId, userId, role);
      } catch (e) {
        if (e instanceof AuthzError) {
          return c.json({ error: e.message }, e.status as 403);
        }
        const msg = e instanceof Error ? e.message : "Failed";
        return c.json({ error: msg }, 400);
      }
      return c.json({ ok: true });
    },
  );

  r.post(
    "/users/:userId/suspend",
    zValidator("param", userIdParamSchema),
    zValidator("json", adminSuspendBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const role = c.get("userRole") ?? "user";
      await container.adminUserService.suspend(role, userId, reason ?? null);
      return c.json({ ok: true });
    },
  );

  r.post("/users/:userId/unsuspend", zValidator("param", userIdParamSchema), async (c) => {
    const { userId } = c.req.valid("param");
    const role = c.get("userRole") ?? "user";
    await container.adminUserService.unsuspend(role, userId);
    return c.json({ ok: true });
  });

  r.get(
    "/users/:userId/activity",
    zValidator("param", userIdParamSchema),
    zValidator("query", activityQuerySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { limit } = c.req.valid("query");
      const data = await container.adminUserService.activityFor(userId, limit);
      return c.json({ data });
    },
  );

  return r;
}
