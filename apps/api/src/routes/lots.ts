import {
  type CreateLotInput,
  type UserRole,
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
  updateLotMarketingDetailsSchema,
  updateLotSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Container } from "../container.js";
import { type AuthzError, LotError } from "../lib/errors.js";
import { asHttpStatus } from "../lib/http-status.js";
import { listLotDocumentsPublic } from "../lib/list-lot-documents-public.js";
import { computeLotCheckoutPricing } from "../lib/lot-checkout-pricing.js";
import { maskLotForPublicView } from "../lib/lot-public-view.js";
import { presentLotImages } from "../lib/media-presenters.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import { createRequireKyc } from "../middleware/require-kyc.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createLotRoutes(container: Container, authenticator: IAuthenticator) {
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
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
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
      },
      role,
      staffRole,
    );
    return c.json({ data });
  });

  r.post("/bulk", requireAuth, zValidator("json", bulkLotsBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const { ids, op } = c.req.valid("json");
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    const result = await container.lotService.bulkPublishOrCancel(userId, role, ids, op, staff);
    if (result.isErr()) {
      return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
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
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const result = await container.lotService.cancel(userId, role, id, staff);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
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
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
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
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
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
    if (!roleHasCapability(role, "auction.manage", staff)) {
      return c.json({ error: "Only staff with auction.manage can create lots" }, 403);
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json") as CreateLotInput;
    if (!body.sellerLegalEntityId) {
      return c.json({ error: "sellerLegalEntityId is required" }, 400);
    }
    const result = await container.lotService.create(userId, body);
    if (result.isErr()) {
      return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
    }
    return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) }, 201);
  });

  return r;
}
