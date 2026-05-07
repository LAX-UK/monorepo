import {
  adminReviewTask,
  artistProfile,
  domainEvent,
  kycVerification,
  legalEntity,
  legalEntityDocument,
  lot,
  payment,
  payout,
  user,
} from "@auction/db/schema";
import {
  encodeActingContextCookie,
  normalizeUserRole,
  normalizeUserRoleOrClient,
  redactDomainEventPayload,
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
  paymentIdParamSchema,
  userIdParamSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { Container } from "../container.js";
import { AuthzError } from "../lib/errors.js";
import { asHttpStatus } from "../lib/http-status.js";
import { parseActingLegalEntityCookieFromHeader } from "../lib/impersonation-cookie.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  createRequireCapability,
  requireFinanceAccess,
  requirePlatformAdmin,
} from "../middleware/require-capability.js";
import { ADMIN_IMPERSONATION_AGGREGATE_TYPE } from "../services/impersonation-audit.service.js";
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

const impersonationRecordFailedEndBodySchema = z.object({
  sessionId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
});

const adminPaymentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export function createAdminRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
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
        await container.impersonationAuditService.reconcileFromAdminRequestCookie({
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

  platform.get("/metrics/finance-issues", async (c) => {
    const staleIdentityCutoff = new Date(Date.now() - 48 * 3600 * 1000);
    const staleBlockedPayoutCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [
      [failedRow],
      [dueRow],
      [staleBlockedPayoutRow],
      [entitiesPendingRow],
      [artistsPendingRow],
      [staleKycRow],
      [docsPendingRow],
    ] = await Promise.all([
        container.db
          .select({ n: sql<number>`count(*)::int` })
          .from(payout)
          .where(eq(payout.status, "failed")),
        container.db
          .select({ n: sql<number>`count(*)::int` })
          .from(legalEntity)
          .where(sql`jsonb_array_length(${legalEntity.stripeConnectRequirementsCurrentlyDue}) > 0`),
        container.db
          .select({ n: sql<number>`count(*)::int` })
          .from(payout)
          .innerJoin(legalEntity, eq(payout.legalEntityId, legalEntity.id))
          .where(
            and(
              eq(payout.status, "scheduled"),
              lt(payout.createdAt, staleBlockedPayoutCutoff),
              sql`(
                ${legalEntity.stripeConnectPayoutsEnabled} = false
                OR jsonb_array_length(${legalEntity.stripeConnectRequirementsCurrentlyDue}) > 0
              )`,
            ),
          ),
        container.db
          .select({ n: sql<number>`count(*)::int` })
          .from(legalEntity)
          .where(inArray(legalEntity.status, ["docs_received", "under_review"])),
        container.db
          .select({ n: sql<number>`count(*)::int` })
          .from(artistProfile)
          .where(eq(artistProfile.status, "pending")),
        container.db
          .select({ n: sql<number>`count(*)::int` })
          .from(kycVerification)
          .where(
            and(
              inArray(kycVerification.status, ["created", "requires_input", "processing"]),
              lt(kycVerification.createdAt, staleIdentityCutoff),
            ),
          ),
        container.db
          .select({ n: sql<number>`count(*)::int` })
          .from(legalEntityDocument)
          .where(eq(legalEntityDocument.reviewStatus, "pending")),
      ]);
    return c.json({
      data: {
        failedPayoutCount: Number(failedRow?.n ?? 0),
        legalEntitiesWithStripeConnectRequirementsCount: Number(dueRow?.n ?? 0),
        staleBlockedScheduledPayoutCount: Number(staleBlockedPayoutRow?.n ?? 0),
        entitiesPendingReviewCount: Number(entitiesPendingRow?.n ?? 0),
        artistsPendingApprovalCount: Number(artistsPendingRow?.n ?? 0),
        staleIdentitySessionsCount: Number(staleKycRow?.n ?? 0),
        documentsAwaitingReviewCount: Number(docsPendingRow?.n ?? 0),
      },
    });
  });

  /** Lists for onboarding / compliance queues (DSE20). */
  platform.get("/onboarding-issues", async (c) => {
    const staleIdentityCutoff = new Date(Date.now() - 48 * 3600 * 1000);
    const [entities, artists, staleKycSessions, pendingDocuments] = await Promise.all([
      container.db
        .select({
          id: legalEntity.id,
          displayName: legalEntity.displayName,
          status: legalEntity.status,
        })
        .from(legalEntity)
        .where(inArray(legalEntity.status, ["docs_received", "under_review"]))
        .orderBy(asc(legalEntity.displayName))
        .limit(80),
      container.db
        .select({
          id: artistProfile.id,
          displayName: artistProfile.displayName,
          status: artistProfile.status,
        })
        .from(artistProfile)
        .where(eq(artistProfile.status, "pending"))
        .orderBy(asc(artistProfile.displayName))
        .limit(80),
      container.db
        .select({
          id: kycVerification.id,
          userId: kycVerification.userId,
          status: kycVerification.status,
          createdAt: kycVerification.createdAt,
        })
        .from(kycVerification)
        .where(
          and(
            inArray(kycVerification.status, ["created", "requires_input", "processing"]),
            lt(kycVerification.createdAt, staleIdentityCutoff),
          ),
        )
        .orderBy(desc(kycVerification.createdAt))
        .limit(80),
      container.db
        .select({
          id: legalEntityDocument.id,
          legalEntityId: legalEntityDocument.legalEntityId,
          entityDisplayName: legalEntity.displayName,
          uploadObjectId: legalEntityDocument.uploadObjectId,
          uploadedAt: legalEntityDocument.uploadedAt,
        })
        .from(legalEntityDocument)
        .innerJoin(legalEntity, eq(legalEntityDocument.legalEntityId, legalEntity.id))
        .where(eq(legalEntityDocument.reviewStatus, "pending"))
        .orderBy(desc(legalEntityDocument.uploadedAt))
        .limit(80),
    ]);

    return c.json({
      data: {
        entitiesPendingReview: entities,
        artistsPendingApproval: artists,
        staleIdentitySessions: staleKycSessions,
        documentsAwaitingReview: pendingDocuments,
      },
    });
  });

  platform.get("/legal-entities/stripe-connect-requirements", requireLegalEntityRead, async (c) => {
    const rows = await container.db
      .select({
        id: legalEntity.id,
        displayName: legalEntity.displayName,
        status: legalEntity.status,
      })
      .from(legalEntity)
      .where(sql`jsonb_array_length(${legalEntity.stripeConnectRequirementsCurrentlyDue}) > 0`)
      .orderBy(asc(legalEntity.displayName))
      .limit(200);
    return c.json({ data: rows });
  });

  platform.get("/payments/manual-review", requireFinanceAccess, async (c) => {
    const rows = await container.db
      .select({
        paymentId: payment.id,
        lotId: payment.lotId,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        winnerUserId: payment.buyerId,
        winnerEmail: user.email,
        sellerLegalEntityId: payment.sellerLegalEntityId,
        sellerDisplayName: legalEntity.displayName,
        sellerStatus: legalEntity.status,
        sellerArchivedAt: legalEntity.statusChangedAt,
        amount: payment.amount,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .innerJoin(legalEntity, eq(payment.sellerLegalEntityId, legalEntity.id))
      .innerJoin(user, eq(payment.buyerId, user.id))
      .where(sql`${payment.status} = 'requires_manual_review'`)
      .orderBy(desc(payment.createdAt))
      .limit(100);

    const data = [];
    for (const row of rows) {
      const [archiveEvent] = await container.db
        .select({ payload: domainEvent.payload, occurredAt: domainEvent.occurredAt })
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.aggregateType, "legal_entity"),
            eq(domainEvent.aggregateId, row.sellerLegalEntityId),
            eq(domainEvent.eventType, "legal_entity.archived"),
          ),
        )
        .orderBy(desc(domainEvent.id))
        .limit(1);
      const payload = archiveEvent?.payload as { reason?: unknown } | undefined;
      data.push({
        ...row,
        amount: String(row.amount),
        currency: "GBP",
        archiveReason: typeof payload?.reason === "string" ? payload.reason : null,
        archiveTimestamp: row.sellerArchivedAt ?? archiveEvent?.occurredAt ?? null,
      });
    }

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
      const result = await container.paymentService.releaseManualReviewForCapture(userId, role, id);
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
      const result = await container.paymentService.refundManualReviewPayment(userId, role, id);
      return result.match(
        () => c.json({ ok: true }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  platform.get("/attention", async (c) => {
    const data = await container.attentionFeedReader.list();
    return c.json({ data });
  });

  /** GET /admin/lots/artist-backfill-review — pending `lot_artist_backfill` tasks (SE-P23). */
  platform.get("/lots/artist-backfill-review", async (c) => {
    const rows = await container.db
      .select()
      .from(adminReviewTask)
      .where(
        and(
          eq(adminReviewTask.kind, "lot_artist_backfill"),
          eq(adminReviewTask.status, "pending"),
        ),
      )
      .orderBy(desc(adminReviewTask.createdAt))
      .limit(200);
    return c.json({ data: rows });
  });

  /** GET /admin/audit/domain-events/export — redacted JSON/CSV export (PII bypass requires audit.read_pii). */
  platform.get("/audit/domain-events/export", async (c) => {
    const role = normalizeUserRoleOrClient(c.get("userRole"));
    const includePii =
      c.req.query("includePii") === "1" && roleHasCapability(role, "audit.read_pii");
    const format = c.req.query("format") === "csv" ? "csv" : "json";

    const rows = await container.db
      .select({
        id: domainEvent.id,
        aggregateType: domainEvent.aggregateType,
        aggregateId: domainEvent.aggregateId,
        eventType: domainEvent.eventType,
        payload: domainEvent.payload,
        actorUserId: domainEvent.actorUserId,
        actingLegalEntityId: domainEvent.actingLegalEntityId,
        occurredAt: domainEvent.occurredAt,
      })
      .from(domainEvent)
      .orderBy(desc(domainEvent.id))
      .limit(5000);

    const redacted = rows.map((r) => ({
      ...r,
      payload: redactDomainEventPayload(r.eventType, r.payload, { includePii }),
    }));

    if (format === "json") {
      return c.json({ data: redacted });
    }

    const esc = (v: string) => {
      if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const header =
      "id,aggregate_type,aggregate_id,event_type,actor_user_id,acting_legal_entity_id,occurred_at,payload_json\n";
    const body = redacted
      .map((r) =>
        [
          String(r.id),
          esc(r.aggregateType),
          esc(r.aggregateId),
          esc(r.eventType),
          esc(r.actorUserId ?? ""),
          esc(r.actingLegalEntityId ?? ""),
          esc(r.occurredAt.toISOString()),
          esc(JSON.stringify(r.payload)),
        ].join(","),
      )
      .join("\n");
    return c.text(header + body, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="domain-events.csv"',
    });
  });

  platform.get("/categories", zValidator("query", adminCategoryListQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.categoryService.listForAdmin({
      includeArchived: q.includeArchived,
    });
    return c.json({ data });
  });

  platform.post("/categories", zValidator("json", adminCreateCategoryBodySchema), async (c) => {
    const body = c.req.valid("json");
    const data = await container.categoryService.create(body);
    return c.json({ data }, 201);
  });

  platform.get("/categories/:categoryId", zValidator("param", categoryIdParamSchema), async (c) => {
    const { categoryId } = c.req.valid("param");
    const data = await container.categoryService.getForAdmin(categoryId);
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
      const data = await container.categoryService.update(categoryId, body);
      return c.json({ data });
    },
  );

  platform.post(
    "/categories/:categoryId/archive",
    zValidator("param", categoryIdParamSchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      const data = await container.categoryService.archive(categoryId);
      return c.json({ data });
    },
  );

  platform.delete(
    "/categories/:categoryId",
    zValidator("param", categoryIdParamSchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      await container.categoryService.delete(categoryId);
      return c.json({ ok: true });
    },
  );

  platform.get("/artists", zValidator("query", adminArtistListQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.artistProfileService.list({
      includeArchived: q.includeArchived,
      ...(q.q ? { q: q.q } : {}),
    });
    return c.json({ data });
  });

  platform.post("/artists", zValidator("json", adminCreateArtistBodySchema), async (c) => {
    const data = await container.artistProfileService.create(c.req.valid("json"));
    return c.json({ data }, 201);
  });

  platform.get("/artists/:artistId", zValidator("param", artistIdParamSchema), async (c) => {
    const { artistId } = c.req.valid("param");
    const data = await container.artistProfileService.getById(artistId);
    if (!data) return c.json({ error: "Not found" }, 404);
    return c.json({ data });
  });

  platform.patch(
    "/artists/:artistId",
    zValidator("param", artistIdParamSchema),
    zValidator("json", adminUpdateArtistBodySchema),
    async (c) => {
      const { artistId } = c.req.valid("param");
      const data = await container.artistProfileService.update(artistId, c.req.valid("json"));
      return c.json({ data });
    },
  );

  platform.get("/email/outbox", zValidator("query", adminListOutboxQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.emailObservabilityRepository.listOutbox({
      ...(q.status ? { status: q.status } : {}),
      limit: q.limit,
      offset: q.offset,
    });
    return c.json({ data });
  });

  platform.get("/email/events", zValidator("query", adminListEventsQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.emailObservabilityRepository.listEvents(q);
    return c.json({ data });
  });

  platform.get(
    "/email/suppressions",
    zValidator("query", adminListSuppressionsQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.emailObservabilityRepository.listSuppressions(q);
      return c.json({ data });
    },
  );

  platform.delete(
    "/email/suppressions/:emailHash",
    zValidator("param", emailHashParamSchema),
    async (c) => {
      const { emailHash } = c.req.valid("param");
      await container.emailObservabilityRepository.deleteSuppression({ emailHash });
      return c.json({ ok: true });
    },
  );

  platform.post(
    "/email/suppressions/bulk",
    zValidator("json", adminBulkEmailSuppressionsBodySchema),
    async (c) => {
      const { emailHashes } = c.req.valid("json");
      for (const emailHash of emailHashes) {
        await container.emailObservabilityRepository.deleteSuppression({ emailHash });
      }
      return c.json({ ok: true, data: { count: emailHashes.length } });
    },
  );

  platform.get("/users", zValidator("query", adminUserListQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.adminUserService.list({
      q: q.q,
      limit: q.limit,
      offset: q.offset,
    });
    return c.json({ data });
  });

  platform.post("/users/bulk", zValidator("json", adminBulkUsersBodySchema), async (c) => {
    const { ids, op, reason } = c.req.valid("json");
    const role = c.get("userRole") ?? "client";
    for (const userId of ids) {
      if (op === "suspend") {
        await container.adminUserService.suspend(role, userId, reason ?? null);
      } else {
        await container.adminUserService.unsuspend(role, userId);
      }
    }
    return c.json({ ok: true, data: { count: ids.length } });
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

  platform.get(
    "/impersonation/lookup",
    zValidator("query", impersonationLookupQuerySchema),
    async (c) => {
      if (normalizeUserRole(c.get("userRole")) !== "administrator") {
        return c.json({ error: "Forbidden" }, 403);
      }
      const { legalEntityId } = c.req.valid("query");
      const entity = await container.legalEntityRepository.findById(legalEntityId);
      if (!entity) {
        return c.json({ error: "Not found" }, 404);
      }
      return c.json({
        data: { id: entity.id, displayName: entity.displayName, status: entity.status },
      });
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

      const [started] = await container.db
        .select({
          id: domainEvent.id,
          actingLegalEntityId: domainEvent.actingLegalEntityId,
        })
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.aggregateType, ADMIN_IMPERSONATION_AGGREGATE_TYPE),
            eq(domainEvent.aggregateId, sessionId),
            eq(domainEvent.eventType, "admin.impersonation_started"),
            eq(domainEvent.actorUserId, userId),
          ),
        )
        .limit(1);

      if (!started) {
        return c.json({ error: "session_not_found" }, 404);
      }
      if (started.actingLegalEntityId !== legalEntityId) {
        return c.json({ error: "legal_entity_mismatch" }, 400);
      }

      const [ended] = await container.db
        .select({ id: domainEvent.id })
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.aggregateType, ADMIN_IMPERSONATION_AGGREGATE_TYPE),
            eq(domainEvent.aggregateId, sessionId),
            eq(domainEvent.eventType, "admin.impersonation_ended"),
          ),
        )
        .limit(1);

      if (ended) {
        return c.json({ ok: true, alreadyEnded: true });
      }

      await container.db.transaction(async (tx) => {
        await container.impersonationSessionService.end(sessionId, "cookie_cleared_after_failed_end");
        await container.domainEventPublisher.publish(tx, {
          aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
          aggregateId: sessionId,
          eventType: "admin.impersonation_ended",
          payload: {
            session_id: sessionId,
            end_reason: "cookie_cleared_after_failed_end",
          },
          actorUserId: userId,
          actingLegalEntityId: legalEntityId,
          schemaVersion: 1,
        });
      });

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

      const existingMembership = await container.legalEntityRepository.findActiveMembership(
        userId,
        legalEntityId,
      );
      if (existingMembership) {
        return c.json(
          {
            error: "not_impersonation",
            message:
              "You are already a member of this entity; use the standard acting context switcher.",
          },
          400,
        );
      }

      const entity = await container.legalEntityRepository.findById(legalEntityId);
      if (!entity) {
        return c.json({ error: "Not found" }, 404);
      }

      const prev = parseActingLegalEntityCookieFromHeader(c.req.header("Cookie"));
      const prevSessionId = prev?.i?.sid;
      const prevEntityId = prev?.e;

      const session = await container.impersonationSessionService.start(userId, entity.id);
      const sessionId = session.id;
      const expiresAt = session.expiresAt;

      await container.db.transaction(async (tx) => {
        if (prevSessionId && prevEntityId) {
          await container.impersonationSessionService.end(prevSessionId, "session_replaced");
          await container.domainEventPublisher.publish(tx, {
            aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
            aggregateId: prevSessionId,
            eventType: "admin.impersonation_ended",
            payload: {
              session_id: prevSessionId,
              end_reason: "session_replaced",
            },
            actorUserId: userId,
            actingLegalEntityId: prevEntityId,
            schemaVersion: 1,
          });
        }

        await container.domainEventPublisher.publish(tx, {
          aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
          aggregateId: sessionId,
          eventType: "admin.impersonation_started",
          payload: {
            impersonating_user_id: userId,
            target_legal_entity_id: entity.id,
            target_legal_entity_display_name: entity.displayName,
            session_id: sessionId,
            expires_at: expiresAt.toISOString(),
          },
          actorUserId: userId,
          actingLegalEntityId: entity.id,
          schemaVersion: 1,
        });
      });

      const actingCookie = encodeActingContextCookie({
        v: 1,
        e: entity.id,
        n: entity.displayName,
        i: { sid: sessionId },
      });

      return c.json({
        data: {
          actingCookie,
          sessionId,
          expiresAt: expiresAt.toISOString(),
          displayName: entity.displayName,
        },
      });
    },
  );

  platform.post("/impersonation/end", async (c) => {
    const userId = c.get("userId") as string;
    if (normalizeUserRole(c.get("userRole")) !== "administrator") {
      return c.json({ error: "Forbidden" }, 403);
    }

    const cookiePayload = parseActingLegalEntityCookieFromHeader(c.req.header("Cookie"));
    const imp = cookiePayload?.i;
    if (!imp?.sid || !cookiePayload?.e) {
      return c.json({ error: "no_active_impersonation" }, 400);
    }

    await container.db.transaction(async (tx) => {
      await container.impersonationSessionService.end(imp.sid, "manual");
      await container.domainEventPublisher.publish(tx, {
        aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
        aggregateId: imp.sid,
        eventType: "admin.impersonation_ended",
        payload: {
          session_id: imp.sid,
          end_reason: "manual",
        },
        actorUserId: userId,
        actingLegalEntityId: cookiePayload.e,
        schemaVersion: 1,
      });
    });

    return c.json({ ok: true });
  });

  attachAdminLegalEntityLifecycleRoutes(platform, container);

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
