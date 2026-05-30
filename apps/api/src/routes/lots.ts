import {
  type CreateLotInput,
  type UserRole,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import {
  archiveCountQuerySchema,
  archiveSummaryQuerySchema,
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createConditionReportRequestBodySchema,
  createLotSchema,
  listLotsQuerySchema,
  lotIdParamSchema,
  scheduleAbsenteeBidBodySchema,
  setAutoBidBodySchema,
  updateLotMarketingDetailsSchema,
  updateLotSchema,
} from "@auction/validators";
import type { Context } from "hono";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Container } from "../container.js";
import { canManageCatalogue } from "../lib/catalogue-auth.js";
import { type AuthzError, LotError, missingCatalogueCapabilityError } from "../lib/errors.js";
import { serviceErrorJsonBody } from "../lib/forbidden-response.js";
import { asHttpStatus } from "../lib/http-status.js";
import { listLotDocumentsPublic } from "../lib/list-lot-documents-public.js";
import { computeLotCheckoutPricing } from "../lib/lot-checkout-pricing.js";
import { maskLotForPublicView } from "../lib/lot-public-view.js";
import { lotsWithCheckoutPricing } from "../lib/lots-with-checkout-pricing.js";
import { presentLotImages } from "../lib/media-presenters.js";
import { zValidator } from "../lib/z-validator.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import { createRequireKyc } from "../middleware/require-kyc.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createBidUserRateLimitMiddleware } from "./bids.js";

export function createLotRoutes(container: Container, authenticator: IAuthenticator) {
  const biddingKillSwitch = createMiddleware(async (c, next) => {
    if (container.env?.DISABLE_BIDDING) {
      return c.json({ error: "Bidding temporarily disabled", code: "bidding_disabled" }, 503);
    }
    await next();
  });
  const bidUserRateLimit = createBidUserRateLimitMiddleware(container.redis);
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const optionalAuth = createOptionalAuth(authenticator);
  const kyc = container.kycService;
  const kycGate =
    kyc?.isConfigured() === true
      ? createRequireKyc(kyc)
      : createMiddleware<{ Variables: { userId?: string } }>(async (_c, next) => {
          await next();
        });
  const requireLegalEntity = container.requireSubmissionsLegalEntityContext;
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRole?: string | null;
      legalEntityContext?: { legalEntityId: string };
    };
  }>();

  function jsonLotOrAuthzError(c: Context, e: LotError | AuthzError) {
    if (e instanceof LotError && e.code) {
      return c.json({ error: e.message, code: e.code }, asHttpStatus(e.status));
    }
    return c.json({ error: e.message }, asHttpStatus(e.status));
  }

  r.get("/", optionalAuth, zValidator("query", listLotsQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const role = c.get("userRole");
    const staffRole = c.get("userStaffRole");
    const { data } = await container.lotService.listLotsForPublicApi(
      {
        status: query.status,
        categoryId: query.categoryId,
        categoryIds: query.categoryIds,
        sellerLegalEntityId: query.sellerId,
        winnerId: query.winnerId,
        saleId: query.saleId,
        artistId: query.artistId,
        endYear: query.endYear,
        search: query.q,
        sort: query.sort,
        limit: query.limit,
        offset: query.offset,
        ...(query.needsPhotos === "1" ? { needsPhotos: true } : {}),
      },
      role,
      staffRole,
    );
    const viewerRole = normalizeUserRoleOrClient(role);
    const staff = normalizeUserStaffRole(staffRole ?? undefined);
    const canSeeLifecycle =
      roleHasCapability(viewerRole, "catalogue.write", staff) ||
      roleHasCapability(viewerRole, "auction.manage", staff);
    let rows = data;
    if (canSeeLifecycle && data.length > 0) {
      const snapshots = await container.lotLifecycleQueryService.getSnapshotsForLots(
        data.map((l) => l.id),
      );
      rows = data.map((lotRow) => {
        const snap = snapshots.get(lotRow.id);
        if (!snap) return lotRow;
        return {
          ...lotRow,
          lifecycleSummary: {
            lastEventType: snap.lastEventType,
            lastEventAt: snap.lastEventAt.toISOString(),
            returnCount: snap.returnCount,
          },
        };
      });
    }
    const withPricing = await lotsWithCheckoutPricing(container, rows);
    return c.json({ data: withPricing });
  });

  r.post("/bulk", requireAuth, zValidator("json", bulkLotsBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const { ids, op, reason } = c.req.valid("json");
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    const result = await container.lotService.bulkPublishOrCancel(
      userId,
      role,
      ids,
      op,
      staff,
      reason,
    );
    if (result.isErr()) {
      return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
    }
    const { attempted, failed, errors } = result.value;
    return c.json({
      data: { attempted, failed, errors },
    });
  });

  r.get("/archive/summary", zValidator("query", archiveSummaryQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const { total, count } = await container.lotService.archiveEndedSummary({
      endYear: q.endYear,
    });
    return c.json({
      data: { totalHammer: total, endedLotCount: count },
    });
  });

  r.get("/archive/count", zValidator("query", archiveCountQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const count = await container.lotService.countMatching({
      status: "ended",
      categoryId: q.categoryId,
      categoryIds: q.categoryIds,
      endYear: q.endYear,
    });
    return c.json({ count });
  });

  r.post("/:id/publish", requireAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const { id } = c.req.valid("param");
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    const result = await container.lotService.publish(userId, role, id, staff);
    if (result.isErr()) {
      return jsonLotOrAuthzError(c, result.error);
    }
    return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) });
  });

  r.post("/:id/withdraw-request", requireAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const sellerUserId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const result = await container.lotService.requestWithdrawal(sellerUserId, id);
    if (result.isErr()) {
      return jsonLotOrAuthzError(c, result.error);
    }
    return c.json({ data: result.value }, result.value.alreadyPending ? 200 : 201);
  });

  r.post(
    "/:id/cancel",
    requireAuth,
    zValidator("param", lotIdParamSchema),
    zValidator("json", cancelLotBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const result = await container.lotService.cancel(
        userId,
        role,
        id,
        staff,
        body.reason?.trim() ? "admin_override" : "manual",
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) });
    },
  );

  r.patch(
    "/:id",
    requireAuth,
    zValidator("param", lotIdParamSchema),
    zValidator("json", updateLotSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json") as Partial<CreateLotInput>;
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const result = await container.lotService.update(role, id, body, staff);
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) });
    },
  );

  r.put(
    "/:id/marketing-details",
    requireAuth,
    zValidator("param", lotIdParamSchema),
    zValidator("json", updateLotMarketingDetailsSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const result = await container.lotService.updateMarketingDetails(role, id, body, staff);
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) });
    },
  );

  r.post(
    "/:id/absentee-bids",
    requireAuth,
    requireBuyerRole,
    kycGate,
    zValidator("param", lotIdParamSchema),
    zValidator("json", scheduleAbsenteeBidBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.absenteeBidService.schedule({
        userId,
        lotId: id,
        buyerLegalEntityId: body.buyerLegalEntityId,
        maxAmount: body.maxAmount,
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value }, 201);
    },
  );

  r.post(
    "/:id/condition-report-requests",
    requireAuth,
    requireBuyerRole,
    kycGate,
    zValidator("param", lotIdParamSchema),
    zValidator("json", createConditionReportRequestBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.conditionReportService.createRequest({
        userId,
        lotId: id,
        ...(body.requestNote !== undefined ? { requestNote: body.requestNote } : {}),
        ...(body.requestingLegalEntityId !== undefined
          ? { requestingLegalEntityId: body.requestingLegalEntityId }
          : {}),
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value }, 201);
    },
  );

  r.get("/:id/bids", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const result = await container.lotService.listBidsForPublicApi({
      lotId: id,
      viewerRole: (c.get("userRole") ?? "client") as UserRole,
      viewerStaffRole: normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined),
      viewerId: c.get("userId"),
      limitQuery: c.req.query("limit"),
    });
    if (result.kind === "not_found") {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ data: result.data });
  });

  r.get("/:id/documents", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const data = await listLotDocumentsPublic(
      container.db,
      container.objectStorage,
      container.mediaUrlResolver,
      id,
    );
    return c.json({ data });
  });

  r.get("/:id", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const role = c.get("userRole");
    const staffRole = c.get("userStaffRole");
    const lot = await container.lotService.getById(id);
    if (!lot) {
      return c.json({ error: "Not found" }, 404);
    }
    const presented = await presentLotImages(container.mediaUrlResolver, lot);
    const sale = lot.saleId ? await container.saleService.getById(lot.saleId) : null;
    const withPricing = {
      ...presented,
      checkoutPricing: computeLotCheckoutPricing(presented, sale),
    };
    return c.json({ data: maskLotForPublicView(withPricing, role, staffRole) });
  });

  r.post("/", requireAuth, zValidator("json", createLotSchema), async (c) => {
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    if (!canManageCatalogue(role, staff)) {
      const e = missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can create lots",
        role,
        staff,
      );
      return c.json(serviceErrorJsonBody(e), asHttpStatus(e.status));
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json") as CreateLotInput;
    if (!body.sellerLegalEntityId) {
      return c.json({ error: "sellerLegalEntityId is required" }, 400);
    }
    const result = await container.lotService.create(userId, body);
    if (result.isErr()) {
      return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
    }
    return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) }, 201);
  });

  r.get(
    "/:id/auto-bid",
    requireAuth,
    requireBuyerRole,
    zValidator("param", lotIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.autoBidService.getAutoBid({
        lotId: id,
        placedByUserId: userId,
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value });
    },
  );

  r.put(
    "/:id/auto-bid",
    requireAuth,
    biddingKillSwitch,
    requireBuyerRole,
    kycGate,
    requireLegalEntity,
    bidUserRateLimit,
    zValidator("param", lotIdParamSchema),
    zValidator("json", setAutoBidBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const legalEntityContext = c.get("legalEntityContext");
      const body = c.req.valid("json");
      const idem = c.req.header("idempotency-key") ?? c.req.header("Idempotency-Key");
      const result = await container.autoBidService.setAutoBid({
        lotId: id,
        placedByUserId: userId,
        buyerLegalEntityId: legalEntityContext?.legalEntityId ?? "",
        maxAutoBidAmount: body.maxAutoBidAmount,
        autoBidStepAmount: body.autoBidStepAmount,
        ...(idem ? { idempotencyKey: idem } : {}),
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value }, 200);
    },
  );

  r.delete(
    "/:id/auto-bid",
    requireAuth,
    requireBuyerRole,
    zValidator("param", lotIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.autoBidService.clearAutoBid({
        lotId: id,
        placedByUserId: userId,
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value });
    },
  );

  return r;
}
