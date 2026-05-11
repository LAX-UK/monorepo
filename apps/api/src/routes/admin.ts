import {
  type UserRole,
  normalizeUserRole,
  normalizeUserRoleOrClient,
  roleHasCapability,
} from "@auction/types";
import {
  adminAnalyticsQuerySchema,
  adminArtistListQuerySchema,
  adminBulkEmailSuppressionsBodySchema,
  adminBulkUsersBodySchema,
  adminCategoryListQuerySchema,
  adminCreateArtistBodySchema,
  adminCreateCategoryBodySchema,
  adminDomainEventsQuerySchema,
  adminFinanceDisputeDomainEventsQuerySchema,
  adminListEventsQuerySchema,
  adminListOutboxQuerySchema,
  adminListSuppressionsQuerySchema,
  adminSetRoleBodySchema,
  adminSubmissionCountQuerySchema,
  adminSuspendBodySchema,
  adminUpdateArtistBodySchema,
  adminUpdateCategoryBodySchema,
  adminUserListQuerySchema,
  artistIdParamSchema,
  categoryIdParamSchema,
  emailHashParamSchema,
  lotIdParamSchema,
  paymentIdParamSchema,
  userIdParamSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { Container } from "../container.js";
import type { AdminLegalEntityBrowseParams } from "../lib/admin-legal-entity-browse.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  createRequireCapability,
  requireFinanceAccess,
  requirePlatformAdmin,
} from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { attachAdminInvitationRoutes } from "./admin-invitations.js";
import { attachAdminLegalEntityLifecycleRoutes } from "./admin-legal-entity-lifecycle.js";
import { attachXeroAdminRoutes } from "./xero-admin.js";

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const impersonationStartBodySchema = z.object({
  legalEntityId: z.string().uuid(),
});

const impersonationLookupQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
});

const adminLegalEntityBrowseQuerySchema = z.object({
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

const impersonationRecordFailedEndBodySchema = z.object({
  sessionId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
});

const adminPaymentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export function createAdminRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.admin.requestLifecycle.isSuspended(id),
  });

  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();
  r.use("*", requireAuth);

  const platform = new Hono<{ Variables: { userId?: string; userRole?: string } }>();
  platform.use("*", requirePlatformAdmin);
  const requireLegalEntityRead = createRequireCapability("legal_entity.read");
  platform.use(
    "*",
    createMiddleware<{ Variables: { userId?: string; userRole?: string } }>(async (c, next) => {
      if (normalizeUserRole(c.get("userRole")) === "administrator") {
        await container.admin.requestLifecycle.reconcileAdminRequestCookie({
          actorUserId: c.get("userId") as string,
          cookieHeader: c.req.header("Cookie"),
        });
      }
      await next();
    }),
  );

  platform.get(
    "/submissions/pending-count",
    zValidator("query", adminSubmissionCountQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const count = await container.admin.ops.countPendingSubmissions({
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
    const data = await container.admin.ops.getAnalyticsDashboard({ start, end });
    return c.json({ data });
  });

  platform.get("/metrics/today", async (c) => {
    const data = await container.admin.ops.getTodayMetrics();
    return c.json({ data });
  });

  platform.get("/metrics/live", async (c) => {
    const bidsPerMinute = await container.admin.ops.getBidsPerMinute();
    return c.json({ data: { bidsPerMinute } });
  });

  platform.get("/metrics/finance-issues", async (c) => {
    const data = await container.admin.dashboard.getFinanceIssueSnapshot();
    return c.json({ data });
  });

  /** Lists for onboarding / compliance queues (DSE20). */
  platform.get("/onboarding-issues", async (c) => {
    const data = await container.admin.dashboard.getOnboardingIssues();
    return c.json({ data });
  });

  platform.get("/legal-entities/stripe-connect-requirements", requireLegalEntityRead, async (c) => {
    const rows = await container.admin.dashboard.listStripeConnectRequirementEntities();
    return c.json({ data: rows });
  });

  platform.get(
    "/legal-entities/browse",
    requireLegalEntityRead,
    zValidator("query", adminLegalEntityBrowseQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const input: AdminLegalEntityBrowseParams = {
        limit: query.limit,
        offset: query.offset,
      };
      const trimmed = query.q?.trim();
      if (trimmed) input.q = trimmed;
      const data = await container.admin.dashboard.searchLegalEntitiesBrowse(input);
      return c.json({ data });
    },
  );

  platform.get("/payments/manual-review", requireFinanceAccess, async (c) => {
    const data = await container.admin.dashboard.listManualReviewPayments();
    return c.json({ data });
  });

  platform.post(
    "/payments/:id/capture-and-process",
    requireFinanceAccess,
    zValidator("param", adminPaymentIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = c.get("userRole") ?? "client";
      const { id } = c.req.valid("param");
      const result = await container.admin.payments.releaseManualReviewForCapture(userId, role, id);
      return result.match(
        () => c.json({ ok: true }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  platform.post(
    "/payments/:id/refund-buyer",
    requireFinanceAccess,
    zValidator("param", adminPaymentIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = c.get("userRole") ?? "client";
      const { id } = c.req.valid("param");
      const result = await container.admin.payments.refundManualReviewPayment(userId, role, id);
      return result.match(
        () => c.json({ ok: true }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  platform.get("/attention", async (c) => {
    const data = await container.admin.ops.listAttentionFeed();
    return c.json({ data });
  });

  /** GET /admin/lots/artist-backfill-review — pending `lot_artist_backfill` tasks (SE-P23). */
  platform.get("/lots/artist-backfill-review", async (c) => {
    const rows = await container.admin.dashboard.listPendingAdminReviewTasks("lot_artist_backfill");
    return c.json({ data: rows });
  });

  /** GET /admin/lots/withdrawal-requests — pending seller withdrawal tasks (B3). */
  platform.get("/lots/withdrawal-requests", async (c) => {
    const rows =
      await container.admin.dashboard.listPendingAdminReviewTasks("lot_withdrawal_request");
    return c.json({ data: rows });
  });

  /** POST /admin/lots/:id/approve-withdrawal-request — cancel lot after seller request (B3). */
  platform.post(
    "/lots/:id/approve-withdrawal-request",
    zValidator("param", lotIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = normalizeUserRoleOrClient(c.get("userRole")) as UserRole;
      const { id } = c.req.valid("param");
      const out = await container.admin.lots.approveWithdrawalRequest(userId, role, id);
      if (!out.ok) {
        return c.json(
          out.code !== undefined ? { error: out.error, code: out.code } : { error: out.error },
          asHttpStatus(out.status),
        );
      }
      return c.json({ data: out.data });
    },
  );

  /** GET /admin/audit/domain-events — paginated feed (PII redacted by default). */
  platform.get(
    "/audit/domain-events",
    zValidator("query", adminDomainEventsQuerySchema),
    async (c) => {
      const { limit, eventTypePrefix } = c.req.valid("query");
      const role = normalizeUserRoleOrClient(c.get("userRole"));
      const includePii =
        c.req.query("includePii") === "1" && roleHasCapability(role, "audit.read_pii");
      const data = await container.admin.domainEvents.listRedacted({
        limit,
        includePii,
        ...(eventTypePrefix !== undefined ? { eventTypePrefix } : {}),
      });
      return c.json({ data });
    },
  );

  /** GET /admin/audit/domain-events/export — redacted JSON/CSV export (PII bypass requires audit.read_pii). */
  platform.get("/audit/domain-events/export", async (c) => {
    const role = normalizeUserRoleOrClient(c.get("userRole"));
    const includePii =
      c.req.query("includePii") === "1" && roleHasCapability(role, "audit.read_pii");
    const format = c.req.query("format") === "csv" ? "csv" : "json";

    const redacted = await container.admin.domainEvents.listForExport({ includePii });

    if (format === "json") {
      return c.json({ data: redacted });
    }

    const csv = container.admin.domainEvents.formatExportCsv(redacted);
    return c.text(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="domain-events.csv"',
    });
  });

  platform.get("/categories", zValidator("query", adminCategoryListQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.admin.catalog.listCategoriesForAdmin({
      includeArchived: q.includeArchived,
    });
    return c.json({ data });
  });

  platform.post("/categories", zValidator("json", adminCreateCategoryBodySchema), async (c) => {
    const body = c.req.valid("json");
    const data = await container.admin.catalog.createCategory(body);
    return c.json({ data }, 201);
  });

  platform.get("/categories/:categoryId", zValidator("param", categoryIdParamSchema), async (c) => {
    const { categoryId } = c.req.valid("param");
    const data = await container.admin.catalog.getCategory(categoryId);
    if (!data) return c.json({ error: "Not found" }, 404);
    return c.json({ data });
  });

  platform.patch(
    "/categories/:categoryId",
    zValidator("param", categoryIdParamSchema),
    zValidator("json", adminUpdateCategoryBodySchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      const body = c.req.valid("json");
      const data = await container.admin.catalog.updateCategory(categoryId, body);
      return c.json({ data });
    },
  );

  platform.post(
    "/categories/:categoryId/archive",
    zValidator("param", categoryIdParamSchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      const data = await container.admin.catalog.archiveCategory(categoryId);
      return c.json({ data });
    },
  );

  platform.delete(
    "/categories/:categoryId",
    zValidator("param", categoryIdParamSchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      await container.admin.catalog.deleteCategory(categoryId);
      return c.json({ ok: true });
    },
  );

  platform.get("/artists", zValidator("query", adminArtistListQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.admin.catalog.listArtists({
      includeArchived: q.includeArchived,
      ...(q.q ? { q: q.q } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.ownerUserId ? { ownerUserId: q.ownerUserId } : {}),
    });
    return c.json({ data });
  });

  platform.post("/artists", zValidator("json", adminCreateArtistBodySchema), async (c) => {
    const adminUserId = c.get("userId") as string;
    const data = await container.admin.catalog.createArtist(adminUserId, c.req.valid("json"));
    return c.json({ data }, 201);
  });

  platform.get("/artists/:artistId", zValidator("param", artistIdParamSchema), async (c) => {
    const { artistId } = c.req.valid("param");
    const data = await container.admin.catalog.getArtist(artistId);
    if (!data) return c.json({ error: "Not found" }, 404);
    return c.json({ data });
  });

  platform.patch(
    "/artists/:artistId",
    zValidator("param", artistIdParamSchema),
    zValidator("json", adminUpdateArtistBodySchema),
    async (c) => {
      const { artistId } = c.req.valid("param");
      const data = await container.admin.catalog.updateArtist(artistId, c.req.valid("json"));
      return c.json({ data });
    },
  );

  platform.get("/email/outbox", zValidator("query", adminListOutboxQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.admin.email.listOutbox({
      ...(q.status ? { status: q.status } : {}),
      limit: q.limit,
      offset: q.offset,
    });
    return c.json({ data });
  });

  platform.get("/email/events", zValidator("query", adminListEventsQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.admin.email.listEvents(q);
    return c.json({ data });
  });

  platform.get(
    "/email/suppressions",
    zValidator("query", adminListSuppressionsQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.email.listSuppressions(q);
      return c.json({ data });
    },
  );

  platform.delete(
    "/email/suppressions/:emailHash",
    zValidator("param", emailHashParamSchema),
    async (c) => {
      const { emailHash } = c.req.valid("param");
      await container.admin.email.deleteSuppression({ emailHash });
      return c.json({ ok: true });
    },
  );

  platform.post(
    "/email/suppressions/bulk",
    zValidator("json", adminBulkEmailSuppressionsBodySchema),
    async (c) => {
      const { emailHashes } = c.req.valid("json");
      const count = await container.admin.email.deleteSuppressionsBulk(emailHashes);
      return c.json({ ok: true, data: { count } });
    },
  );

  platform.get("/users", zValidator("query", adminUserListQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.admin.users.list({
      q: q.q,
      limit: q.limit,
      offset: q.offset,
    });
    return c.json({ data });
  });

  platform.post("/users/bulk", zValidator("json", adminBulkUsersBodySchema), async (c) => {
    const { ids, op, reason } = c.req.valid("json");
    const role = c.get("userRole") ?? "client";
    const data = await container.admin.users.bulkSuspendOrUnsuspend({
      actorRole: role,
      ids,
      op,
      reason,
    });
    return c.json({ ok: true, data });
  });

  platform.get("/users/:userId", zValidator("param", userIdParamSchema), async (c) => {
    const { userId } = c.req.valid("param");
    const row = await container.admin.users.getById(userId);
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
      const setOut = await container.admin.users.setRole(actorRole, actorId, userId, role);
      if (!setOut.ok) {
        return c.json({ error: setOut.message }, asHttpStatus(setOut.status));
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
      await container.admin.users.suspend(role, userId, reason ?? null);
      return c.json({ ok: true });
    },
  );

  platform.post("/users/:userId/unsuspend", zValidator("param", userIdParamSchema), async (c) => {
    const { userId } = c.req.valid("param");
    const role = c.get("userRole") ?? "client";
    await container.admin.users.unsuspend(role, userId);
    return c.json({ ok: true });
  });

  platform.get(
    "/users/:userId/activity",
    zValidator("param", userIdParamSchema),
    zValidator("query", activityQuerySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { limit } = c.req.valid("query");
      const data = await container.admin.users.activityFor(userId, limit);
      return c.json({ data });
    },
  );

  platform.get(
    "/impersonation/lookup",
    zValidator("query", impersonationLookupQuerySchema),
    async (c) => {
      if (normalizeUserRole(c.get("userRole")) !== "administrator") {
        return c.json({ error: "Forbidden" }, 403);
      }
      const { legalEntityId } = c.req.valid("query");
      const out = await container.admin.impersonation.lookupForImpersonation(legalEntityId);
      if (!out.ok) return c.json({ error: "Not found" }, 404);
      return c.json({ data: out.data });
    },
  );

  platform.post(
    "/impersonation/record-failed-end",
    zValidator("json", impersonationRecordFailedEndBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      if (normalizeUserRole(c.get("userRole")) !== "administrator") {
        return c.json({ error: "Forbidden" }, 403);
      }
      const { sessionId, legalEntityId } = c.req.valid("json");
      const out = await container.admin.impersonation.recordFailedEnd({
        actorUserId: userId,
        sessionId,
        legalEntityId,
      });
      if (!out.ok) {
        return c.json({ error: out.error }, out.status);
      }
      if (out.alreadyEnded) return c.json({ ok: true, alreadyEnded: true });
      return c.json({ ok: true });
    },
  );

  platform.post(
    "/impersonation/start",
    zValidator("json", impersonationStartBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      if (normalizeUserRole(c.get("userRole")) !== "administrator") {
        return c.json({ error: "Forbidden" }, 403);
      }
      const { legalEntityId } = c.req.valid("json");
      const out = await container.admin.impersonation.startImpersonation({
        actorUserId: userId,
        legalEntityId,
        cookieHeader: c.req.header("Cookie"),
      });
      if (!out.ok) {
        return c.json(
          out.error === "not_impersonation"
            ? { error: out.error, message: out.message }
            : { error: out.error },
          out.status,
        );
      }
      return c.json({ data: out.data });
    },
  );

  platform.post("/impersonation/end", async (c) => {
    const userId = c.get("userId") as string;
    if (normalizeUserRole(c.get("userRole")) !== "administrator") {
      return c.json({ error: "Forbidden" }, 403);
    }
    const out = await container.admin.impersonation.endImpersonation({
      actorUserId: userId,
      cookieHeader: c.req.header("Cookie"),
    });
    if (!out.ok) {
      return c.json({ error: "no_active_impersonation" }, 400);
    }
    return c.json({ ok: true });
  });

  attachAdminLegalEntityLifecycleRoutes(platform, container.admin.legalEntityLifecycle);

  attachAdminInvitationRoutes(platform, container.admin.invitations);

  const finance = new Hono<{ Variables: { userId?: string; userRole?: string } }>();
  finance.use("*", requireFinanceAccess);

  /** GET /admin/finance/dispute-domain-events — `payment.dispute*` only (accountant-safe). */
  finance.get(
    "/finance/dispute-domain-events",
    zValidator("query", adminFinanceDisputeDomainEventsQuerySchema),
    async (c) => {
      const { limit } = c.req.valid("query");
      const role = normalizeUserRoleOrClient(c.get("userRole"));
      const includePii =
        c.req.query("includePii") === "1" && roleHasCapability(role, "audit.read_pii");
      const data = await container.admin.domainEvents.listRedacted({
        limit,
        eventTypePrefix: "payment.dispute",
        includePii,
      });
      return c.json({ data });
    },
  );

  finance.post("/payments/:id/xero-sync", zValidator("param", paymentIdParamSchema), async (c) => {
    const role = c.get("userRole") ?? "client";
    const { id } = c.req.valid("param");
    const result = await container.admin.payments.syncPaymentFromXeroAsAdmin(role, id);
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  attachXeroAdminRoutes(finance, container.admin);

  r.route("/", platform);
  r.route("/", finance);

  return r;
}
