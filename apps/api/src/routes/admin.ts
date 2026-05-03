import {
  adminAnalyticsQuerySchema,
  adminSetRoleBodySchema,
  adminSubmissionCountQuerySchema,
  adminSuspendBodySchema,
  adminUserListQuerySchema,
  paymentIdParamSchema,
  userIdParamSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { AuthzError } from "../lib/errors.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireFinanceAccess, requirePlatformAdmin } from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { attachAdminInvitationRoutes } from "./admin-invitations.js";
import { attachXeroAdminRoutes } from "./xero-admin.js";

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export function createAdminRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();
  r.use("*", requireAuth);

  const platform = new Hono<{ Variables: { userId?: string; userRole?: string } }>();
  platform.use("*", requirePlatformAdmin);

  platform.get(
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

  platform.get("/analytics", zValidator("query", adminAnalyticsQuerySchema), async (c) => {
    const { days } = c.req.valid("query");
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);
    const data = await container.analyticsService.getDashboard({ start, end });
    return c.json({ data });
  });

  platform.get("/metrics/today", async (c) => {
    const data = await container.adminMetricsService.getTodaySnapshot();
    return c.json({ data });
  });

  platform.get("/metrics/live", async (c) => {
    const bidsPerMinute = await container.adminMetricsService.getBidsPerMinute();
    return c.json({ data: { bidsPerMinute } });
  });

  platform.get("/attention", async (c) => {
    const data = await container.attentionFeedReader.list();
    return c.json({ data });
  });

  platform.get("/users", zValidator("query", adminUserListQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.adminUserService.list({
      q: q.q,
      limit: q.limit,
      offset: q.offset,
    });
    return c.json({ data });
  });

  platform.get("/users/:userId", zValidator("param", userIdParamSchema), async (c) => {
    const { userId } = c.req.valid("param");
    const row = await container.adminUserService.getById(userId);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ data: row });
  });

  platform.patch(
    "/users/:userId/role",
    zValidator("param", userIdParamSchema),
    zValidator("json", adminSetRoleBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { role } = c.req.valid("json");
      const actorRole = c.get("userRole") ?? "client";
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

  platform.post(
    "/users/:userId/suspend",
    zValidator("param", userIdParamSchema),
    zValidator("json", adminSuspendBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const role = c.get("userRole") ?? "client";
      await container.adminUserService.suspend(role, userId, reason ?? null);
      return c.json({ ok: true });
    },
  );

  platform.post("/users/:userId/unsuspend", zValidator("param", userIdParamSchema), async (c) => {
    const { userId } = c.req.valid("param");
    const role = c.get("userRole") ?? "client";
    await container.adminUserService.unsuspend(role, userId);
    return c.json({ ok: true });
  });

  platform.get(
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

  attachAdminInvitationRoutes(platform, container);

  const finance = new Hono<{ Variables: { userId?: string; userRole?: string } }>();
  finance.use("*", requireFinanceAccess);

  finance.post("/payments/:id/xero-sync", zValidator("param", paymentIdParamSchema), async (c) => {
    const role = c.get("userRole") ?? "client";
    const { id } = c.req.valid("param");
    const result = await container.paymentService.syncPaymentFromXeroAsAdmin(role, id);
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  attachXeroAdminRoutes(finance, container);

  r.route("/", platform);
  r.route("/", finance);

  return r;
}
