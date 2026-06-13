import type { lotFulfilment } from "@auction/db/schema";

type LotFulfilmentStatusCol = (typeof lotFulfilment.$inferSelect)["status"];
import {
  type UserRole,
  legalEntityKinds,
  legalEntityStatuses,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import {
  adminAnalyticsQuerySchema,
  adminArtistListQuerySchema,
  adminBulkEmailSuppressionsBodySchema,
  adminBulkUsersBodySchema,
  adminCategoryListQuerySchema,
  adminConditionReportListQuerySchema,
  adminConveyorPipelineQuerySchema,
  adminCreateArtistBodySchema,
  adminCreateCategoryBodySchema,
  adminDomainEventsQuerySchema,
  adminFinanceDisputeDomainEventsQuerySchema,
  adminFinanceDisputesQuerySchema,
  adminListEventsQuerySchema,
  adminListOutboxQuerySchema,
  adminListSuppressionsQuerySchema,
  adminLotBrowseQuerySchema,
  adminLotFulfilmentListQuerySchema,
  adminLotFulfilmentLotIdParamSchema,
  adminPatchStaffRoleBodySchema,
  adminQrCodeAnalyticsQuerySchema,
  adminQrCodeCreateSchema,
  adminQrCodeEntityQuerySchema,
  adminQrCodeIdParamSchema,
  adminQrCodeRegenerateSchema,
  adminQrCodeUpdateSchema,
  adminRejectSaleRegistrationBodySchema,
  adminSaleRegistrationListQuerySchema,
  adminSaleRegistrationParamsSchema,
  adminSaleroomSaleIdParamSchema,
  adminSetRoleBodySchema,
  adminSubmissionCountBySellersQuerySchema,
  adminSubmissionCountQuerySchema,
  adminSuspendBodySchema,
  adminTelephonePlaceBidBodySchema,
  adminUpdateArtistBodySchema,
  adminUpdateCategoryBodySchema,
  adminUserIdsLookupQuerySchema,
  adminUserListQuerySchema,
  artistIdParamSchema,
  categoryIdParamSchema,
  conditionReportRequestIdParamSchema,
  declineConditionReportRequestBodySchema,
  emailHashParamSchema,
  fulfillConditionReportRequestBodySchema,
  lotFulfilmentCollectBodySchema,
  lotFulfilmentReleaseBodySchema,
  lotFulfilmentShipBodySchema,
  lotIdOnlyParamSchema,
  lotIdParamSchema,
  paymentIdParamSchema,
  returnLotToInventoryBodySchema,
  saleroomAdvanceLotBodySchema,
  updateProfileNameFormSchema,
  userIdParamSchema,
} from "@auction/validators";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { Container } from "../container.js";
import type { AdminLegalEntityBrowseParams } from "../lib/admin-legal-entity-browse.js";
import { mapAdminUserListQuery } from "../lib/admin-user-list-query.js";
import { asHttpStatus } from "../lib/http-status.js";
import { presentLotImages } from "../lib/media-presenters.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requireAdminDashboard,
  requireAmlReview,
  requireAnalytics,
  requireArtistReviewAccess,
  requireArtistWriteAccess,
  requireArtistsAccess,
  requireAuctionManage,
  requireAuditDomainEvents,
  requireCatalogueWrite,
  requireCategoriesAccess,
  requireClientActivity,
  requireClientBids,
  requireClientKyc,
  requireEmailAdmin,
  requireEmailObservability,
  requireFinanceAccess,
  requireLegalEntityBrowse,
  requireLotsAccess,
  requireMlroDecision,
  requireOnboardingQueues,
  requireOperationsFulfilment,
  requirePlatformAdminFull,
  requirePlatformShell,
  requireQrCodesAccess,
  requireSpecialistCatalogueOrAuctionManage,
  requireSubmissionsAccess,
  requireUserInvite,
  requireUserModeration,
  requireUsersDirectory,
  requireVenuesAccess,
} from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { attachAdminInvitationRoutes } from "./admin-invitations.js";
import { attachAdminLegalEntityLifecycleRoutes } from "./admin-legal-entity-lifecycle.js";
import { attachAdminMarketingEventsRoutes } from "./admin-marketing-events.js";
import { createAdminOnsiteEventRoutes } from "./admin-onsite-events.js";
import { attachAdminQueuesRoutes } from "./admin-queues.js";
import { attachAdminStripeConnectRoutes } from "./admin-stripe-connect.routes.js";
import { createAdminTelephoneBookingRoutes } from "./telephone-bookings.js";
import { attachXeroAdminRoutes } from "./xero-admin.js";

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const userBidsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const impersonationStartBodySchema = z.object({
  legalEntityId: z.string().uuid(),
});

const impersonationLookupQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
});

const adminLegalEntityBrowseQuerySchema = z.object({
  q: z.string().max(200).optional(),
  createdByUserId: z.string().uuid().optional(),
  status: z.enum(legalEntityStatuses).optional(),
  kind: z.enum(legalEntityKinds).optional(),
  stripeDue: z.enum(["0", "1"]).optional(),
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

const amlScreeningIdParamSchema = z.object({
  id: z.string().uuid(),
});

const amlReviewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

const sourceOfFundsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  status: z.enum(["pending", "rejected"]).optional().default("pending"),
});

const amlReviewBodySchema = z.object({
  decision: z.enum(["clear", "block"]),
  notes: z.string().max(2000).optional(),
});

const amlTriageBodySchema = z.object({
  recommendation: z.enum(["clear", "block"]),
  notes: z.string().max(2000).optional(),
});

const sourceOfFundsIdParamSchema = z.object({
  id: z.string().uuid(),
});

const sourceOfFundsReviewBodySchema = z.object({
  decision: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});

const sourceOfFundsTriageBodySchema = z.object({
  recommendation: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});

/** Only match UUID segments so static routes (`search`, `stats`, …) are never captured. */
const adminArtistIdSegment =
  ":artistId{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}";

export function createAdminRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.admin.requestLifecycle.isSuspended(id),
  });

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();
  r.use("*", requireAuth);

  const platform = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();
  platform.use("*", requirePlatformShell);
  const requireLegalEntityRead = requireLegalEntityBrowse;
  platform.use(
    "*",
    createMiddleware<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>(async (c, next) => {
      await container.admin.requestLifecycle.reconcileAdminRequestCookie({
        actorUserId: c.get("userId") as string,
        cookieHeader: c.req.header("Cookie"),
      });
      await next();
    }),
  );

  platform.get("/submissions/quality-gaps-count", requireSubmissionsAccess, async (c) => {
    const count = await container.itemSubmissionService.countQualityGapsForAdminApi();
    return c.json({ data: { count } });
  });

  platform.get(
    "/submissions/pending-count",
    requireSubmissionsAccess,
    zValidator("query", adminSubmissionCountQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const count = await container.admin.ops.countPendingSubmissions({
        status: q.status,
      });
      return c.json({ data: { count } });
    },
  );

  platform.get(
    "/submissions/count-by-sellers",
    requireSubmissionsAccess,
    zValidator("query", adminSubmissionCountBySellersQuerySchema),
    async (c) => {
      const { sellerIds } = c.req.valid("query");
      const count =
        await container.itemSubmissionService.countSubmissionsBySellersForAdminApi(sellerIds);
      return c.json({ data: { count } });
    },
  );

  /** Seller intake → catalogue → live: submissions joined to converted lots (recent first). */
  platform.get(
    "/conveyor-pipeline",
    requireOperationsFulfilment,
    zValidator("query", adminConveyorPipelineQuerySchema),
    async (c) => {
      const { limit } = c.req.valid("query");
      const data = await container.admin.ops.listConveyorPipeline(limit);
      return c.json({ data });
    },
  );

  platform.get(
    "/analytics",
    requireAnalytics,
    zValidator("query", adminAnalyticsQuerySchema),
    async (c) => {
      const { days } = c.req.valid("query");
      const end = new Date();
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - days);
      const data = await container.admin.ops.getAnalyticsDashboard({ start, end });
      return c.json({ data });
    },
  );

  platform.get("/metrics/today", requireAdminDashboard, async (c) => {
    const data = await container.admin.ops.getTodayMetrics();
    return c.json({ data });
  });

  platform.get("/metrics/live", requireAdminDashboard, async (c) => {
    const bidsPerMinute = await container.admin.ops.getBidsPerMinute();
    return c.json({ data: { bidsPerMinute } });
  });

  platform.get("/nav-counts", requireAdminDashboard, async (c) => {
    const data = await container.adminNavCountsService.getCounts();
    return c.json({ data });
  });

  platform.get(
    "/qr-codes",
    requireQrCodesAccess,
    zValidator("query", adminQrCodeEntityQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const items = await container.qrCodeService.listForEntity(q.entityType, q.entityId);
      return c.json({ data: { items } });
    },
  );

  platform.post(
    "/qr-codes",
    requireCatalogueWrite,
    zValidator("json", adminQrCodeCreateSchema),
    async (c) => {
      const body = c.req.valid("json");
      const result = await container.qrCodeService.getOrCreateDefault({
        entityType: body.entityType,
        entityId: body.entityId,
        actorUserId: c.get("userId") ?? null,
      });
      if (!result) return c.json({ error: "Not found" }, 404);

      // This endpoint is an idempotent "ensure" used by detail pages and bulk
      // label printing. Only apply metadata when a code is freshly created so
      // repeated calls never clobber values set via PATCH. Edits go through the
      // dedicated PATCH /qr-codes/:id route.
      const hasMetadata =
        body.campaign !== undefined || body.placement !== undefined || body.expiresAt !== undefined;
      const item =
        result.created && hasMetadata
          ? ((await container.qrCodeService.update(result.item.id, {
              campaign: body.campaign ?? null,
              placement: body.placement ?? null,
              expiresAt: body.expiresAt ?? null,
            })) ?? result.item)
          : result.item;
      return c.json({ data: item }, result.created ? 201 : 200);
    },
  );

  platform.post(
    "/qr-codes/regenerate",
    requireCatalogueWrite,
    zValidator("json", adminQrCodeRegenerateSchema),
    async (c) => {
      const body = c.req.valid("json");
      const item = await container.qrCodeService.regenerateDefault({
        entityType: body.entityType,
        entityId: body.entityId,
        actorUserId: c.get("userId") ?? null,
      });
      if (!item) return c.json({ error: "Not found" }, 404);
      return c.json({ data: item }, 201);
    },
  );

  platform.patch(
    "/qr-codes/:id",
    requireCatalogueWrite,
    zValidator("param", adminQrCodeIdParamSchema),
    zValidator("json", adminQrCodeUpdateSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const item = await container.qrCodeService.update(id, c.req.valid("json"));
      if (!item) return c.json({ error: "Not found" }, 404);
      return c.json({ data: item });
    },
  );

  platform.get(
    "/qr-codes/:id/analytics",
    requireQrCodesAccess,
    zValidator("param", adminQrCodeIdParamSchema),
    zValidator("query", adminQrCodeAnalyticsQuerySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { days } = c.req.valid("query");
      const data = await container.qrCodeService.analytics(id, days);
      return c.json({ data });
    },
  );

  platform.get("/metrics/finance-issues", requireAdminDashboard, async (c) => {
    const data = await container.admin.dashboard.getFinanceIssueSnapshot();
    return c.json({ data });
  });

  /** Lists for onboarding / compliance queues (DSE20). */
  platform.get("/onboarding-issues", requireOnboardingQueues, async (c) => {
    const data = await container.admin.dashboard.getOnboardingIssues();
    return c.json({ data });
  });

  platform.get("/legal-entities/stripe-connect-requirements", requireLegalEntityRead, async (c) => {
    const rows = await container.admin.dashboard.listStripeConnectRequirementEntities();
    return c.json({ data: rows });
  });

  platform.get(
    "/condition-report-requests",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("query", adminConditionReportListQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const { items, total } = await container.conditionReportService.listForAdmin({
        status: q.status,
        lotId: q.lotId,
        limit: q.limit,
        offset: q.offset,
      });
      return c.json({ data: { items, total, limit: q.limit, offset: q.offset } });
    },
  );

  platform.post(
    "/condition-report-requests/:id/mark-in-progress",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("param", conditionReportRequestIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.conditionReportService.markInProgress({
        id,
        actorUserId: userId,
      });
      return result.match(
        (data) => c.json({ data }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/condition-report-requests/:id/fulfill",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("param", conditionReportRequestIdParamSchema),
    zValidator("json", fulfillConditionReportRequestBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.conditionReportService.fulfill({
        id,
        fulfilledByUserId: userId,
        conditionReport: body.conditionReport,
        ...(body.responseNote !== undefined ? { responseNote: body.responseNote } : {}),
        ...(body.responseAttachmentUploadId !== undefined
          ? { responseAttachmentUploadId: body.responseAttachmentUploadId }
          : {}),
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          { error: e.message, ...(e.code ? { code: e.code } : {}) },
          asHttpStatus(e.status),
        );
      }
      const data = await presentLotImages(
        container.mediaUrlResolver,
        result.value,
        container.mediaAssetEnricher,
      );
      return c.json({ data });
    },
  );

  platform.post(
    "/condition-report-requests/:id/decline",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("param", conditionReportRequestIdParamSchema),
    zValidator("json", declineConditionReportRequestBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.conditionReportService.decline({
        id,
        fulfilledByUserId: userId,
        ...(body.responseNote !== undefined ? { responseNote: body.responseNote } : {}),
      });
      return result.match(
        () => c.json({ ok: true }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.get(
    "/sales/:saleId/registrations",
    requireAuctionManage,
    zValidator("param", z.object({ saleId: z.string().uuid() })),
    zValidator("query", adminSaleRegistrationListQuerySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const query = c.req.valid("query");
      const items = await container.saleRegistrationService.listForSaleAdmin({
        saleId,
        status: query.status,
      });
      return c.json({ data: { items } });
    },
  );

  platform.post(
    "/sales/:saleId/registrations/:registrationId/approve",
    requireAuctionManage,
    zValidator("param", adminSaleRegistrationParamsSchema),
    async (c) => {
      const { saleId, registrationId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.saleRegistrationService.approve({
        saleId,
        registrationId,
        decidedByUserId: userId,
      });
      return result.match(
        () => c.json({ ok: true }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/registrations/:registrationId/reject",
    requireAuctionManage,
    zValidator("param", adminSaleRegistrationParamsSchema),
    zValidator("json", adminRejectSaleRegistrationBodySchema),
    async (c) => {
      const { saleId, registrationId } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.saleRegistrationService.reject({
        saleId,
        registrationId,
        decidedByUserId: userId,
        ...(reason !== undefined ? { reason } : {}),
      });
      return result.match(
        () => c.json({ ok: true }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/saleroom/telephone-bids",
    requireAuctionManage,
    zValidator("json", adminTelephonePlaceBidBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      if (body.telephoneBookingId) {
        const lotRow = await container.repoFactory.root.lot.findById(body.lotId);
        if (!lotRow?.saleId) return c.json({ error: "Lot not found" }, 404);
        const bookingCheck =
          await container.telephoneBidBookingService.assertBookingAllowsTelephoneBid({
            bookingId: body.telephoneBookingId,
            saleId: lotRow.saleId,
            lotId: body.lotId,
            amount: body.amount,
            ...(body.maxAutoBidAmount !== undefined
              ? { maxAutoBidAmount: body.maxAutoBidAmount }
              : {}),
          });
        if (bookingCheck.isErr()) {
          const e = bookingCheck.error;
          return c.json(
            e.code ? { error: e.message, code: e.code } : { error: e.message },
            asHttpStatus(e.status),
          );
        }
      }
      const placement = {
        placedVia: "telephone" as const,
        ...(body.telephoneBookingId != null ? { telephoneBookingId: body.telephoneBookingId } : {}),
      };
      const idempotencyKey =
        body.idempotencyKey ??
        c.req.header("idempotency-key") ??
        c.req.header("Idempotency-Key") ??
        (body.telephoneBookingId
          ? `telephone-booking:${body.lotId}:${body.telephoneBookingId}:${body.amount}`
          : undefined);
      const bidInput = {
        placedByUserId: body.buyerUserId,
        buyerLegalEntityId: body.buyerLegalEntityId,
        lotId: body.lotId,
        amount: body.amount,
        ...(body.maxAutoBidAmount !== undefined ? { maxAutoBidAmount: body.maxAutoBidAmount } : {}),
        placedVia: placement.placedVia,
        ...(body.telephoneBookingId != null ? { telephoneBookingId: body.telephoneBookingId } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      };
      if (idempotencyKey) {
        const out = await container.bidService.placeBidWithIdempotency(bidInput);
        if (out.type === "replay") {
          return c.json(out.body, 201);
        }
        if (out.type === "err") {
          const e = out.error;
          return c.json(
            e.code ? { error: e.message, code: e.code } : { error: e.message },
            asHttpStatus(e.status),
          );
        }
        return c.json(out.body, 201);
      }
      const result = await container.bidService.placeBid({
        placedByUserId: body.buyerUserId,
        buyerLegalEntityId: body.buyerLegalEntityId,
        lotId: body.lotId,
        amount: body.amount,
        ...(body.maxAutoBidAmount !== undefined ? { maxAutoBidAmount: body.maxAutoBidAmount } : {}),
        placement,
      });
      return result.match(
        (bid) => c.json({ data: bid }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.get(
    "/sales/:saleId/operations-snapshot",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const data = await container.adminSaleOperationsSnapshotService.getSnapshot(saleId);
      if (!data) return c.json({ error: "Sale not found or not onsite" }, 404);
      return c.json({ data });
    },
  );

  // Hono merges a sub-app's handlers into the parent router, so `subApp.use("*", mw)`
  // registered after the sub-app's routes never guards them and instead gates every
  // platform route registered after the mount. Guards must be path-scoped and
  // registered before the routes they protect.
  platform.use("/telephone-bookings", requireAuctionManage);
  platform.use("/telephone-bookings/*", requireAuctionManage);
  platform.use("/sales/:saleId/telephone-bookings", requireAuctionManage);
  platform.use("/sales/:saleId/telephone-bookings/*", requireAuctionManage);
  platform.route("/", createAdminTelephoneBookingRoutes(container));

  platform.use("/onsite-events", requireAuctionManage);
  platform.use("/onsite-events/*", requireAuctionManage);
  platform.route("/onsite-events", createAdminOnsiteEventRoutes(container));

  platform.get(
    "/sales/:saleId/saleroom/session",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const data = await container.saleroomService.getSessionWithRecentEvents(saleId);
      return c.json({ data });
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/go-live",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.saleroomService.goLive({ saleId, actorUserId: userId });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/pause",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.saleroomService.pause({ saleId, actorUserId: userId });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/resume",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.saleroomService.resume({ saleId, actorUserId: userId });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/advance",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    zValidator("json", saleroomAdvanceLotBodySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const { lotId } = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.saleroomService.advanceToLot({
        saleId,
        lotId,
        actorUserId: userId,
      });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/hammer",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.saleroomService.hammerCurrentLot({
        saleId,
        actorUserId: userId,
      });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/no-sale",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.saleroomService.noSaleCurrentLot({
        saleId,
        actorUserId: userId,
      });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/close",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.saleroomService.closeSession({ saleId, actorUserId: userId });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.get(
    "/lot-fulfilment",
    requireOperationsFulfilment,
    zValidator("query", adminLotFulfilmentListQuerySchema),
    async (c) => {
      const query = adminLotFulfilmentListQuerySchema.parse(c.req.valid("query"));
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const result = await container.lotFulfilmentService.listForAdmin(
        query.status === undefined
          ? {
              ...(query.q ? { q: query.q } : {}),
              limit,
              offset,
            }
          : {
              status: query.status as LotFulfilmentStatusCol,
              ...(query.q ? { q: query.q } : {}),
              limit,
              offset,
            },
      );
      return c.json({
        data: result.items,
        meta: { total: result.total, limit, offset, statusCounts: result.statusCounts },
      });
    },
  );

  platform.get(
    "/lot-fulfilment/:lotId",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const data = await container.lotFulfilmentService.getByLotIdForAdmin(lotId);
      return c.json({ data });
    },
  );

  platform.post(
    "/lot-fulfilment/:lotId/release",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    zValidator("json", lotFulfilmentReleaseBodySchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.lotFulfilmentService.approveRelease({
        lotId,
        actorUserId: userId,
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      });
      return result.match(
        (row) => c.json({ data: row }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/lot-fulfilment/:lotId/ship",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    zValidator("json", lotFulfilmentShipBodySchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.lotFulfilmentService.markShipped({
        lotId,
        actorUserId: userId,
        carrier: body.carrier,
        trackingNumber: body.trackingNumber,
      });
      return result.match(
        (row) => c.json({ data: row }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/lot-fulfilment/:lotId/ready-for-collection",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.lotFulfilmentService.markReadyForCollection({
        lotId,
        actorUserId: userId,
      });
      return result.match(
        (row) => c.json({ data: row }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/lot-fulfilment/:lotId/delivered",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.lotFulfilmentService.markDelivered({
        lotId,
        actorUserId: userId,
      });
      return result.match(
        (row) => c.json({ data: row }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/lot-fulfilment/:lotId/collected",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    zValidator("json", lotFulfilmentCollectBodySchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.lotFulfilmentService.markCollected({
        lotId,
        actorUserId: userId,
        collectedBy: body.collectedBy,
      });
      return result.match(
        (row) => c.json({ data: row }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.get("/platform-catalog/legal-entity-id", requireVenuesAccess, async (c) => {
    const id = await container.resolvePlatformCatalogLegalEntityId();
    return c.json({ data: { id } });
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
      if (query.createdByUserId) input.createdByUserId = query.createdByUserId;
      if (query.status) input.status = query.status;
      if (query.kind) input.kind = query.kind;
      if (query.stripeDue === "1") input.stripeDue = true;
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
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const result = await container.admin.payments.releaseManualReviewForCapture(
        userId,
        role,
        id,
        staffRole,
      );
      return result.match(
        () => c.json({ ok: true }),
        (error) =>
          c.json(
            { error: error.message, ...(error.code ? { code: error.code } : {}) },
            asHttpStatus(error.status),
          ),
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
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const result = await container.admin.payments.refundManualReviewPayment(
        userId,
        role,
        id,
        staffRole,
      );
      return result.match(
        () => c.json({ ok: true }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  platform.get("/attention", requireAdminDashboard, async (c) => {
    const data = await container.admin.ops.listAttentionFeed();
    return c.json({ data });
  });

  /** GET /admin/lots/browse — attachable draft lots for sale setup picker. */
  platform.get(
    "/lots/browse",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("query", adminLotBrowseQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const result = await container.adminLotBrowseService.listAttachable({
        limit: query.limit,
        offset: query.offset,
        state: query.state,
        ...(query.q ? { q: query.q } : {}),
        ...(query.sellerLegalEntityId ? { sellerLegalEntityId: query.sellerLegalEntityId } : {}),
        ...(query.categoryIds ? { categoryIds: query.categoryIds } : {}),
        ...(query.artistId ? { artistId: query.artistId } : {}),
        ...(query.excludeSaleId ? { excludeSaleId: query.excludeSaleId } : {}),
      });
      return c.json({ data: result.data, total: result.total });
    },
  );

  /** GET /admin/lots/:lotId/lifecycle — snapshot + recent events for journey strip. */
  platform.get(
    "/lots/:lotId/lifecycle",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("param", lotIdOnlyParamSchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const snapshot = await container.lotLifecycleQueryService.getSnapshot(lotId);
      const events = await container.lotLifecycleQueryService.timeline(lotId, {
        limit: 10,
        includeSaleContext: true,
      });
      return c.json({
        data: {
          snapshot: snapshot
            ? {
                currentStatus: snapshot.currentStatus,
                lastEventType: snapshot.lastEventType,
                lastEventAt: snapshot.lastEventAt.toISOString(),
                lastSaleId: snapshot.lastSaleId,
                returnCount: snapshot.returnCount,
              }
            : null,
          events: events.map((ev) => ({
            eventType: ev.eventType,
            occurredAt: ev.occurredAt.toISOString(),
            saleTitle: ev.saleTitle ?? null,
          })),
        },
      });
    },
  );

  /** POST /admin/lots/:lotId/return-to-inventory */
  platform.post(
    "/lots/:lotId/return-to-inventory",
    requireAuctionManage,
    zValidator("param", lotIdOnlyParamSchema),
    zValidator("json", returnLotToInventoryBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = normalizeUserRoleOrClient(c.get("userRole")) as UserRole;
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const { lotId } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.lotTransitionOrchestrator.returnToInventory(
        userId,
        role,
        lotId,
        {
          reason: body.reason,
          ...(body.confirmVoided !== undefined ? { confirmVoided: body.confirmVoided } : {}),
          ...(body.notifyBidders !== undefined ? { notifyBidders: body.notifyBidders } : {}),
        },
        staff,
      );
      return result.match(
        (lot) => c.json({ data: lot }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  /** GET /admin/lots/artist-backfill-review — pending `lot_artist_backfill` tasks (SE-P23). */
  platform.get("/lots/artist-backfill-review", requireLotsAccess, async (c) => {
    const rows = await container.admin.dashboard.listPendingAdminReviewTasks("lot_artist_backfill");
    return c.json({ data: rows });
  });

  /** GET /admin/lots/withdrawal-requests — pending seller withdrawal tasks (B3). */
  platform.get("/lots/withdrawal-requests", requireLotsAccess, async (c) => {
    const rows =
      await container.admin.dashboard.listPendingAdminReviewTasks("lot_withdrawal_request");
    return c.json({ data: rows });
  });

  /** POST /admin/lots/:id/approve-withdrawal-request — cancel lot after seller request (B3). */
  platform.post(
    "/lots/:id/approve-withdrawal-request",
    requireLotsAccess,
    zValidator("param", lotIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = normalizeUserRoleOrClient(c.get("userRole")) as UserRole;
      const { id } = c.req.valid("param");
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const out = await container.admin.lots.approveWithdrawalRequest(userId, role, id, staff);
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
    requireAuditDomainEvents,
    zValidator("query", adminDomainEventsQuerySchema),
    async (c) => {
      const { limit, offset, eventTypePrefix, aggregateType, aggregateId } = c.req.valid("query");
      const role = normalizeUserRoleOrClient(c.get("userRole"));
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const includePii =
        c.req.query("includePii") === "1" && roleHasCapability(role, "audit.read_pii", staff);
      const data = await container.admin.domainEvents.listRedacted({
        limit,
        offset,
        includePii,
        ...(eventTypePrefix !== undefined ? { eventTypePrefix } : {}),
        ...(aggregateType !== undefined && aggregateId !== undefined
          ? { aggregateType, aggregateId }
          : {}),
      });
      return c.json({ data });
    },
  );

  platform.get(
    "/categories",
    requireCategoriesAccess,
    zValidator("query", adminCategoryListQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.catalog.listCategoriesForAdmin({
        includeArchived: q.includeArchived,
      });
      return c.json({ data });
    },
  );

  platform.post(
    "/categories",
    requireCatalogueWrite,
    zValidator("json", adminCreateCategoryBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      const data = await container.admin.catalog.createCategory(body, c.get("userId") as string);
      return c.json({ data }, 201);
    },
  );

  platform.get(
    "/categories/:categoryId",
    requireCategoriesAccess,
    zValidator("param", categoryIdParamSchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      const data = await container.admin.catalog.getCategory(categoryId);
      if (!data) return c.json({ error: "Not found" }, 404);
      return c.json({ data });
    },
  );

  platform.patch(
    "/categories/:categoryId",
    requireCatalogueWrite,
    zValidator("param", categoryIdParamSchema),
    zValidator("json", adminUpdateCategoryBodySchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      const body = c.req.valid("json");
      const data = await container.admin.catalog.updateCategory(
        categoryId,
        body,
        c.get("userId") as string,
      );
      return c.json({ data });
    },
  );

  platform.post(
    "/categories/:categoryId/archive",
    requireCatalogueWrite,
    zValidator("param", categoryIdParamSchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      const data = await container.admin.catalog.archiveCategory(
        categoryId,
        c.get("userId") as string,
      );
      return c.json({ data });
    },
  );

  platform.delete(
    "/categories/:categoryId",
    requireCatalogueWrite,
    zValidator("param", categoryIdParamSchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      await container.admin.catalog.deleteCategory(categoryId, c.get("userId") as string);
      return c.json({ ok: true });
    },
  );

  platform.get("/artists/stats", requireArtistsAccess, async (c) => {
    const data = await container.admin.catalog.getArtistStats();
    return c.json({ data });
  });

  const adminArtistSearchQuerySchema = z.object({
    q: z.string().trim().min(1).max(200),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  });

  /** Staff registry search for admin pickers — includes pending/rejected; no public approved-only filter. */
  platform.get(
    "/artists/search",
    requireArtistsAccess,
    zValidator("query", adminArtistSearchQuerySchema),
    async (c) => {
      const { q, limit } = c.req.valid("query");
      const data = await container.artistRegistryService.search(q, limit);
      return c.json({ data });
    },
  );

  platform.get(
    "/artists",
    requireArtistsAccess,
    zValidator("query", adminArtistListQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.catalog.listArtists({
        includeArchived: q.includeArchived,
        archivedOnly: q.archivedOnly,
        ...(q.q ? { q: q.q } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.kinds ? { kinds: q.kinds } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.ownerUserId ? { ownerUserId: q.ownerUserId } : {}),
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
        ...(q.country ? { country: q.country } : {}),
        ...(q.featured === true ? { featured: true } : {}),
        ...(q.verified === true ? { verified: true } : {}),
        linked: q.linked,
        sort: q.sort,
        limit: q.limit,
        offset: q.offset,
      });
      return c.json({ data });
    },
  );

  platform.post(
    "/artists",
    requireArtistWriteAccess,
    zValidator("json", adminCreateArtistBodySchema),
    async (c) => {
      const adminUserId = c.get("userId") as string;
      const data = await container.admin.catalog.createArtist(adminUserId, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  );

  platform.get(
    `/artists/${adminArtistIdSegment}/duplicates`,
    requireArtistReviewAccess,
    zValidator("param", artistIdParamSchema),
    async (c) => {
      const { artistId } = c.req.valid("param");
      const data = await container.admin.catalog.listArtistDuplicateCandidates(artistId);
      return c.json({ data });
    },
  );

  platform.get(
    `/artists/${adminArtistIdSegment}`,
    requireArtistsAccess,
    zValidator("param", artistIdParamSchema),
    async (c) => {
      const { artistId } = c.req.valid("param");
      const data = await container.admin.catalog.getArtist(artistId);
      if (!data) return c.json({ error: "Not found" }, 404);
      return c.json({ data });
    },
  );

  platform.patch(
    `/artists/${adminArtistIdSegment}`,
    requireArtistWriteAccess,
    zValidator("param", artistIdParamSchema),
    zValidator("json", adminUpdateArtistBodySchema),
    async (c) => {
      const { artistId } = c.req.valid("param");
      const data = await container.admin.catalog.updateArtist(artistId, c.req.valid("json"));
      return c.json({ data });
    },
  );

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

  platform.get(
    "/users",
    requireUsersDirectory,
    zValidator("query", adminUserListQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const data = await container.admin.users.list(
        actorRole,
        actorStaff,
        mapAdminUserListQuery(q),
      );
      return c.json({ data });
    },
  );

  platform.get(
    "/users/lookup",
    requireUsersDirectory,
    zValidator("query", adminUserIdsLookupQuerySchema),
    async (c) => {
      const { ids } = c.req.valid("query");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const data = await container.admin.users.getByIds(actorRole, actorStaff, ids);
      return c.json({ data });
    },
  );

  platform.post(
    "/users/bulk",
    requireUserModeration,
    zValidator("json", adminBulkUsersBodySchema),
    async (c) => {
      const { ids, op, reason } = c.req.valid("json");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const data = await container.admin.users.bulkSuspendOrUnsuspend({
        actorRole,
        actorStaffRole: actorStaff,
        ids,
        op,
        reason,
      });
      return c.json({ ok: true, data });
    },
  );

  platform.get(
    "/users/:userId",
    requireUsersDirectory,
    zValidator("param", userIdParamSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const row = await container.admin.users.getById(actorRole, actorStaff, userId);
      if (!row) return c.json({ error: "Not found" }, 404);
      return c.json({ data: row });
    },
  );

  platform.get(
    "/users/:userId/kyc-sessions",
    requireClientKyc,
    zValidator("param", userIdParamSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const data = await container.admin.users.kycSessionsFor(actorRole, actorStaff, userId);
      return c.json({ data });
    },
  );

  platform.get(
    "/users/:userId/aml-screenings",
    requireAmlReview,
    zValidator("param", userIdParamSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const data = await container.amlService.listForUser(userId);
      return c.json({ data });
    },
  );

  // ── AML / sanctions watchlist review (MLRO / compliance) ──────────────────
  platform.get(
    "/compliance/aml/screenings",
    requireAmlReview,
    zValidator("query", amlReviewQuerySchema),
    async (c) => {
      const { limit } = c.req.valid("query");
      const data = await container.amlService.listPendingReviews(limit);
      return c.json({ data });
    },
  );

  // First-line analyst triage (maker): advisory recommendation only.
  platform.post(
    "/compliance/aml/screenings/:id/triage",
    requireAmlReview,
    zValidator("param", amlScreeningIdParamSchema),
    zValidator("json", amlTriageBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { recommendation, notes } = c.req.valid("json");
      const analystUserId = c.get("userId") as string;
      try {
        const record = await container.amlService.triage({
          screeningId: id,
          analystUserId,
          recommendation,
          notes: notes ?? null,
        });
        return c.json({ ok: true, screening: record });
      } catch (err) {
        const message = err instanceof Error ? err.message : "aml_triage_failed";
        if (message === "aml_triage_self_forbidden") {
          return c.json({ error: "aml_triage_self_forbidden" }, 403);
        }
        if (message === "aml_screening_not_pending") {
          return c.json({ error: "aml_screening_not_pending" }, 409);
        }
        if (message === "aml_triage_already_set") {
          return c.json({ error: "aml_triage_already_set" }, 409);
        }
        if (message === "aml_screening_not_found") {
          return c.json({ error: "aml_screening_not_found" }, 404);
        }
        throw err;
      }
    },
  );

  // MLRO decision (checker): binding clear/block. Requires a prior triage by a
  // different user (maker-checker / four-eyes).
  platform.post(
    "/compliance/aml/screenings/:id/decide",
    requireMlroDecision,
    zValidator("param", amlScreeningIdParamSchema),
    zValidator("json", amlReviewBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { decision, notes } = c.req.valid("json");
      const reviewerUserId = c.get("userId") as string;
      try {
        const record = await container.amlService.decide({
          screeningId: id,
          reviewerUserId,
          decision,
          notes: notes ?? null,
        });
        return c.json({ ok: true, screening: record });
      } catch (err) {
        const message = err instanceof Error ? err.message : "aml_review_failed";
        if (message === "aml_review_self_forbidden" || message === "aml_review_same_as_triager") {
          return c.json({ error: message }, 403);
        }
        if (message === "aml_triage_required") {
          return c.json({ error: "aml_triage_required" }, 409);
        }
        if (message === "aml_screening_not_pending") {
          return c.json({ error: "aml_screening_not_pending" }, 409);
        }
        if (message === "aml_screening_not_found") {
          return c.json({ error: "aml_screening_not_found" }, 404);
        }
        throw err;
      }
    },
  );

  // ── Source of Funds review (MLRO / compliance / finance) ──────────────────
  platform.get(
    "/compliance/source-of-funds",
    requireAmlReview,
    zValidator("query", sourceOfFundsListQuerySchema),
    async (c) => {
      const { limit, status } = c.req.valid("query");
      const data = await container.sourceOfFundsService.listByStatus(status, limit);
      return c.json({ data });
    },
  );

  // First-line analyst triage (maker) for a SoF case.
  platform.post(
    "/compliance/source-of-funds/:id/triage",
    requireAmlReview,
    zValidator("param", sourceOfFundsIdParamSchema),
    zValidator("json", sourceOfFundsTriageBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { recommendation, notes } = c.req.valid("json");
      const analystUserId = c.get("userId") as string;
      try {
        const record = await container.sourceOfFundsService.triage({
          caseId: id,
          analystUserId,
          recommendation,
          notes: notes ?? null,
        });
        return c.json({ ok: true, sourceOfFunds: record });
      } catch (err) {
        const message = err instanceof Error ? err.message : "source_of_funds_triage_failed";
        if (message === "source_of_funds_triage_self_forbidden") {
          return c.json({ error: "source_of_funds_triage_self_forbidden" }, 403);
        }
        if (message === "source_of_funds_not_pending") {
          return c.json({ error: "source_of_funds_not_pending" }, 409);
        }
        if (message === "source_of_funds_triage_already_set") {
          return c.json({ error: "source_of_funds_triage_already_set" }, 409);
        }
        if (message === "source_of_funds_not_found") {
          return c.json({ error: "source_of_funds_not_found" }, 404);
        }
        throw err;
      }
    },
  );

  // MLRO/finance decision (checker): binding approve/reject. Requires a prior
  // triage by a different user.
  platform.post(
    "/compliance/source-of-funds/:id/decide",
    requireMlroDecision,
    zValidator("param", sourceOfFundsIdParamSchema),
    zValidator("json", sourceOfFundsReviewBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { decision, notes } = c.req.valid("json");
      const reviewerUserId = c.get("userId") as string;
      try {
        const record = await container.sourceOfFundsService.decide({
          caseId: id,
          reviewerUserId,
          decision,
          notes: notes ?? null,
        });
        return c.json({ ok: true, sourceOfFunds: record });
      } catch (err) {
        const message = err instanceof Error ? err.message : "source_of_funds_review_failed";
        if (
          message === "source_of_funds_review_self_forbidden" ||
          message === "source_of_funds_review_same_as_triager"
        ) {
          return c.json({ error: message }, 403);
        }
        if (message === "source_of_funds_triage_required") {
          return c.json({ error: "source_of_funds_triage_required" }, 409);
        }
        if (message === "source_of_funds_not_pending") {
          return c.json({ error: "source_of_funds_not_pending" }, 409);
        }
        if (message === "source_of_funds_not_found") {
          return c.json({ error: "source_of_funds_not_found" }, 404);
        }
        throw err;
      }
    },
  );

  platform.post(
    "/compliance/source-of-funds/:id/reopen",
    requireMlroDecision,
    zValidator("param", sourceOfFundsIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const actorUserId = c.get("userId") as string;
      try {
        const record = await container.sourceOfFundsService.reopenRejected({
          caseId: id,
          actorUserId,
        });
        return c.json({ ok: true, sourceOfFunds: record });
      } catch (err) {
        const message = err instanceof Error ? err.message : "source_of_funds_reopen_failed";
        if (message === "source_of_funds_not_rejected") {
          return c.json({ error: message }, 409);
        }
        if (message === "source_of_funds_not_found") {
          return c.json({ error: message }, 404);
        }
        throw err;
      }
    },
  );

  platform.patch(
    "/users/:userId/role",
    requireUsersDirectory,
    zValidator("param", userIdParamSchema),
    zValidator("json", adminSetRoleBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { role, staffRole: targetStaffRole } = c.req.valid("json");
      const actorRole = c.get("userRole") ?? "client";
      const actorId = c.get("userId") as string;
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const setOut = await container.admin.users.setRole(
        actorRole,
        actorId,
        userId,
        role,
        actorStaff,
        targetStaffRole ?? null,
      );
      if (!setOut.ok) {
        return c.json({ error: setOut.message }, asHttpStatus(setOut.status));
      }
      return c.json({ ok: true });
    },
  );

  platform.patch(
    "/users/:userId/staff-role",
    requireUsersDirectory,
    zValidator("param", userIdParamSchema),
    zValidator("json", adminPatchStaffRoleBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { staffRole } = c.req.valid("json");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const setOut = await container.admin.users.setStaffRole(
        actorRole,
        c.get("userId") as string,
        userId,
        staffRole,
        actorStaff,
      );
      if (!setOut.ok) {
        return c.json({ error: setOut.message }, asHttpStatus(setOut.status));
      }
      return c.json({ ok: true });
    },
  );

  platform.post(
    "/users/:userId/suspend",
    requireUserModeration,
    zValidator("param", userIdParamSchema),
    zValidator("json", adminSuspendBodySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      await container.admin.users.suspend(actorRole, actorStaff, userId, reason ?? null);
      return c.json({ ok: true });
    },
  );

  platform.post(
    "/users/:userId/unsuspend",
    requireUserModeration,
    zValidator("param", userIdParamSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      await container.admin.users.unsuspend(actorRole, actorStaff, userId);
      return c.json({ ok: true });
    },
  );

  platform.get(
    "/users/:userId/activity",
    requireClientActivity,
    zValidator("param", userIdParamSchema),
    zValidator("query", activityQuerySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { limit } = c.req.valid("query");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const data = await container.admin.users.activityFor(actorRole, actorStaff, userId, limit);
      return c.json({ data });
    },
  );

  platform.get(
    "/users/:userId/bids",
    requireClientBids,
    zValidator("param", userIdParamSchema),
    zValidator("query", userBidsQuerySchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { limit, offset } = c.req.valid("query");
      const actorRole = c.get("userRole") ?? "client";
      const actorStaff = c.get("userStaffRole") as string | null | undefined;
      const data = await container.admin.users.bidsFor(actorRole, actorStaff, userId, {
        limit,
        offset,
      });
      return c.json({ data });
    },
  );

  platform.patch(
    "/users/:userId/profile",
    requireUserInvite,
    zValidator("param", userIdParamSchema),
    zValidator("json", updateProfileNameFormSchema),
    async (c) => {
      const { userId } = c.req.valid("param");
      const body = c.req.valid("json");
      if (body.name == null) {
        return c.json({ error: "name is required" }, 400);
      }
      await container.profileService.updateProfile(userId, { name: body.name });
      return c.json({ ok: true });
    },
  );

  platform.get(
    "/impersonation/lookup",
    requirePlatformAdminFull,
    zValidator("query", impersonationLookupQuerySchema),
    async (c) => {
      const { legalEntityId } = c.req.valid("query");
      const out = await container.admin.impersonation.lookupForImpersonation(legalEntityId);
      if (!out.ok) return c.json({ error: "Not found" }, 404);
      return c.json({ data: out.data });
    },
  );

  platform.post(
    "/impersonation/record-failed-end",
    requirePlatformAdminFull,
    zValidator("json", impersonationRecordFailedEndBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
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
    requirePlatformAdminFull,
    zValidator("json", impersonationStartBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
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

  platform.post("/impersonation/end", requirePlatformAdminFull, async (c) => {
    const userId = c.get("userId") as string;
    const out = await container.admin.impersonation.endImpersonation({
      actorUserId: userId,
      cookieHeader: c.req.header("Cookie"),
    });
    if (!out.ok) {
      return c.json({ error: "no_active_impersonation" }, 400);
    }
    return c.json({ ok: true });
  });

  attachAdminLegalEntityLifecycleRoutes(
    platform,
    container.admin.legalEntityLifecycle,
    container.legalEntityDocumentAdminService,
  );

  attachAdminStripeConnectRoutes(
    platform,
    container.stripeConnectService,
    container.env?.WEB_ORIGIN,
  );

  attachAdminInvitationRoutes(platform, container.admin.invitations);

  attachAdminMarketingEventsRoutes(platform, container);

  attachAdminQueuesRoutes(platform, container);

  // Finance-shell routes must stay reachable for finance_ops, who fails
  // `requirePlatformShell`. Guards are path-scoped (not `use("*")`) so they don't
  // leak onto platform paths once this sub-app is merged into the parent router.
  const finance = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();
  finance.use("/finance/*", requireFinanceAccess);
  finance.use("/payments/:id/xero-sync", requireFinanceAccess);
  finance.use("/integrations/xero/*", requireFinanceAccess);

  /** GET /admin/finance/dispute-domain-events — `payment.dispute*` only (finance-shell-safe). */
  finance.get(
    "/finance/dispute-domain-events",
    zValidator("query", adminFinanceDisputeDomainEventsQuerySchema),
    async (c) => {
      const { limit, offset } = c.req.valid("query");
      const role = normalizeUserRoleOrClient(c.get("userRole"));
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const includePii =
        c.req.query("includePii") === "1" && roleHasCapability(role, "audit.read_pii", staff);
      const data = await container.admin.domainEvents.listRedacted({
        limit,
        offset,
        eventTypePrefix: "payment.dispute",
        includePii,
      });
      return c.json({ data });
    },
  );

  /** GET /admin/finance/disputes — folded Stripe dispute cases for finance admin UI. */
  finance.get(
    "/finance/disputes",
    zValidator("query", adminFinanceDisputesQuerySchema),
    async (c) => {
      const { limit, offset, status } = c.req.valid("query");
      const result = await container.admin.disputeCases.listCases({
        limit,
        offset,
        ...(status !== undefined ? { status } : {}),
      });
      return c.json({
        data: result.rows,
        hasNextPage: result.hasNextPage,
        summary: result.summary,
      });
    },
  );

  /** GET /admin/finance/disputes/open-count — nav badge + anomaly counts. */
  finance.get("/finance/disputes/open-count", async (c) => {
    const count = await container.admin.disputeCases.countOpenCases();
    return c.json({ data: { count } });
  });

  finance.post("/payments/:id/xero-sync", zValidator("param", paymentIdParamSchema), async (c) => {
    const role = c.get("userRole") ?? "client";
    const staffRole = c.get("userStaffRole") ?? null;
    const { id } = c.req.valid("param");
    const result = await container.admin.payments.syncPaymentFromXeroAsAdmin(role, id, staffRole);
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  attachXeroAdminRoutes(finance, container.admin);

  // Mount finance first: its routes terminate the chain before platform's
  // `use("*", requirePlatformShell)` wildcard can 403 finance_ops.
  r.route("/", finance);
  r.route("/", platform);

  return r;
}
