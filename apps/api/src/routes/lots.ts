import { type CreateLotInput, type UserRole, roleHasCapability } from "@auction/types";
import {
  archiveCountQuerySchema,
  archiveSummaryQuerySchema,
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createLotSchema,
  listLotsQuerySchema,
  lotIdParamSchema,
  updateLotMarketingDetailsSchema,
  updateLotSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { type AuthzError, LotError } from "../lib/errors.js";
import { asHttpStatus } from "../lib/http-status.js";
import { maskLotForPublicView } from "../lib/lot-public-view.js";
import { presentLotImages } from "../lib/media-presenters.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createLotRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const optionalAuth = createOptionalAuth(authenticator);
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  function jsonLotOrAuthzError(c: Context, e: LotError | AuthzError) {
    if (e instanceof LotError && e.code) {
      return c.json({ error: e.message, code: e.code }, asHttpStatus(e.status));
    }
    return c.json({ error: e.message }, asHttpStatus(e.status));
  }

  r.get("/", optionalAuth, zValidator("query", listLotsQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const role = c.get("userRole");
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
    );
    return c.json({ data });
  });

  r.post("/bulk", requireAuth, zValidator("json", bulkLotsBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const { ids, op } = c.req.valid("json");
    const result = await container.lotService.bulkPublishOrCancel(userId, role, ids, op);
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
    const result = await container.lotService.publish(userId, role, id);
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
      const result = await container.lotService.cancel(userId, role, id);
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
      const result = await container.lotService.update(role, id, body);
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
      const result = await container.lotService.updateMarketingDetails(role, id, body);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) });
    },
  );

  r.get("/:id/bids", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const result = await container.lotService.listBidsForPublicApi({
      lotId: id,
      viewerRole: (c.get("userRole") ?? "client") as UserRole,
      viewerId: c.get("userId"),
      limitQuery: c.req.query("limit"),
    });
    if (result.kind === "not_found") {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ data: result.data });
  });

  r.get("/:id", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const role = c.get("userRole");
    const lot = await container.lotService.getById(id);
    if (!lot) {
      return c.json({ error: "Not found" }, 404);
    }
    const presented = await presentLotImages(container.mediaUrlResolver, lot);
    return c.json({ data: maskLotForPublicView(presented, role) });
  });

  r.post("/", requireAuth, zValidator("json", createLotSchema), async (c) => {
    const role = (c.get("userRole") ?? "client") as UserRole;
    if (!roleHasCapability(role, "auction.manage")) {
      return c.json({ error: "Only administrators can create lots" }, 403);
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
