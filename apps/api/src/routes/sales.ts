import { type UserRole, normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import {
  attachLotToSaleBodySchema,
  bulkSalesBodySchema,
  cancelSaleBodySchema,
  createNestedLotForSaleSchema,
  createSaleSchema,
  deleteSaleBodySchema,
  listSaleBiddersQuerySchema,
  listSaleLotsQuerySchema,
  listSalesQuerySchema,
  markSaleEndedBodySchema,
  registerForSaleBodySchema,
  saleIdParamSchema,
  saleLotIdParamSchema,
  updateLotStatusBodySchema,
  updateSaleSchema,
} from "@auction/validators";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Container } from "../container.js";
import { canManageCatalogue } from "../lib/catalogue-auth.js";
import { CATALOGUE_WRITE_CAPABILITIES, LotError } from "../lib/errors.js";
import { respondMissingCapability, serviceErrorJsonBody } from "../lib/forbidden-response.js";
import { asHttpStatus } from "../lib/http-status.js";
import {
  presentLotImages,
  presentSaleImages,
  presentSalesWithLotsImages,
} from "../lib/media-presenters.js";
import { buildConnectRequiredByLotId } from "../lib/seller-connect-readiness.js";
import { zValidator } from "../lib/z-validator.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import { createRequireKyc } from "../middleware/require-kyc.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createSaleRoutes(container: Container, authenticator: IAuthenticator) {
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

  r.get("/", optionalAuth, zValidator("query", listSalesQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const userId = c.get("userId");
    const role = c.get("userRole");
    const staff = normalizeUserStaffRole(c.get("userStaffRole") ?? undefined);
    const listFilter = {
      status: query.statuses ? undefined : query.status,
      statuses: query.statuses,
      categoryId: query.categoryId,
      categoryIds: query.categoryIds,
      q: query.q,
      deliveryMode: query.deliveryMode,
      settlementStatus: query.settlementStatus,
      needsSetup: query.needsSetup === "1",
      limit: query.limit,
      offset: query.offset,
      sort: query.sort,
    };
    const canEnrichDelete =
      role != null && roleHasCapability(role as UserRole, "auction.manage", staff);

    const buildPublicPayload = async () => {
      const { data: rows } = await container.saleListReadService.listForPublicApi(listFilter, {
        role,
        staffRole: staff,
      });
      return {
        data: rows.map(({ sale, lotCount, previewLots }) => ({
          sale,
          lots: previewLots,
          lotCount,
        })),
      };
    };

    if (!canEnrichDelete) {
      if (userId == null) {
        const key = container.cachedCatalogueListService.buildKey("sales", query);
        const payload = await container.cachedCatalogueListService.getOrLoad(
          key,
          buildPublicPayload,
        );
        return c.json(payload);
      }
      return c.json(await buildPublicPayload());
    }

    const { data: rows } = await container.saleListReadService.listForPublicApi(listFilter, {
      role,
      staffRole: staff,
    });

    const data = await (async () => {
      const draftScheduled = rows.filter(
        (row) => row.sale.status === "draft" || row.sale.status === "scheduled",
      );
      const lotsBySale =
        draftScheduled.length > 0
          ? await container.repoFactory.root.lot.findBySaleIds(
              draftScheduled.map((row) => row.sale.id),
            )
          : [];
      const lotsBySaleId = new Map<string, typeof lotsBySale>();
      for (const lot of lotsBySale) {
        if (!lot.saleId) continue;
        const arr = lotsBySaleId.get(lot.saleId) ?? [];
        arr.push(lot);
        lotsBySaleId.set(lot.saleId, arr);
      }
      const eligibilityBySale = await container.saleSoftDeleteService.getDeleteEligibilityBatch(
        draftScheduled.map((row) => ({
          sale: row.sale,
          lots: lotsBySaleId.get(row.sale.id) ?? [],
        })),
      );
      return rows.map((row) => {
        if (row.sale.status !== "draft" && row.sale.status !== "scheduled") {
          return row;
        }
        const deleteEligibility = eligibilityBySale.get(row.sale.id);
        return deleteEligibility ? { ...row, deleteEligibility } : row;
      });
    })();

    return c.json({
      data: data.map(({ sale, previewLots, lotCount, ...rest }) => ({
        sale,
        lots: previewLots,
        lotCount,
        ...rest,
      })),
    });
  });

  r.post("/bulk", requireAuth, zValidator("json", bulkSalesBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staffRole = c.get("userStaffRole") ?? null;
    const { ids, confirmationPhrase } = c.req.valid("json");
    const result = await container.saleSoftDeleteService.bulkSoftDelete(
      userId,
      role,
      ids,
      confirmationPhrase,
      staffRole,
    );
    if (result.isErr()) {
      return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
    }
    const { attempted, failed, errors } = result.value;
    return c.json({ data: { attempted, failed, errors } });
  });

  r.post(
    "/:id/register",
    requireAuth,
    requireBuyerRole,
    kycGate,
    zValidator("param", saleIdParamSchema),
    zValidator("json", registerForSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id: saleId } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.saleRegistrationService.requestRegistration({
        userId,
        saleId,
        buyerLegalEntityId: body.buyerLegalEntityId,
        ...(body.bidLimit !== undefined ? { bidLimit: body.bidLimit } : {}),
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

  r.get("/:id/my-registrations", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id: saleId } = c.req.valid("param");
    const items = await container.saleRegistrationService.listMineForSale({ userId, saleId });
    return c.json({ data: { items } });
  });

  r.get("/:id", optionalAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const userId = c.get("userId");
    const detail = await container.saleService.getSaleDetailForPublicApi(id, userId, {
      role: c.get("userRole"),
      staffRole: c.get("userStaffRole"),
    });
    if (!detail) return c.json({ error: "Not found" }, 404);
    return c.json(detail);
  });

  r.get("/:id/catalog-admin", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    if (!canManageCatalogue(role, staff)) {
      return respondMissingCapability(c, {
        message:
          "Only staff with auction.manage or catalogue.write can view catalogue admin detail",
        required: [...CATALOGUE_WRITE_CAPABILITIES],
        actor: { role, staffRole: staff },
      });
    }
    const { id } = c.req.valid("param");
    const detail = await container.saleService.getSaleDetailForCatalogAdmin(id);
    if (!detail) return c.json({ error: "Not found" }, 404);
    const connectEnforced = container.stripeConnectService.isConfigured();
    const connectByLot = await buildConnectRequiredByLotId(
      detail.data.lots,
      container.legalEntityRepository,
      connectEnforced,
    );
    const lotsWithConnect = detail.data.lots.map((lotRow) => ({
      ...lotRow,
      connectRequired: connectByLot.get(lotRow.id) ?? false,
    }));
    const deleteEligibility = roleHasCapability(role, "auction.manage", staff)
      ? await container.saleSoftDeleteService.getDeleteEligibility(id)
      : null;
    return c.json({
      data: {
        ...detail.data,
        lots: lotsWithConnect,
        ...(deleteEligibility ? { deleteEligibility } : {}),
      },
    });
  });

  r.get(
    "/:id/lots",
    optionalAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("query", listSaleLotsQuerySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const q = c.req.valid("query");
      const page = await container.saleService.listSaleLotsPageForPublicApi(
        id,
        {
          limit: q.limit,
          offset: q.offset,
          sort: q.sort,
        },
        { role: c.get("userRole"), staffRole: c.get("userStaffRole") },
      );
      if (!page) return c.json({ error: "Not found" }, 404);
      return c.json(page);
    },
  );

  r.get(
    "/:id/bidders",
    zValidator("param", saleIdParamSchema),
    zValidator("query", listSaleBiddersQuerySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const q = c.req.valid("query");
      const page = await container.saleBiddersService.list(id, {
        limit: q.limit,
        offset: q.offset,
      });
      if (!page) return c.json({ error: "Not found" }, 404);
      return c.json({
        data: {
          items: page.items.map((b) => ({
            maskedName: b.maskedName,
            firstBidAt: b.firstBidAt,
          })),
          total: page.total,
          limit: q.limit,
          offset: q.offset,
        },
      });
    },
  );

  r.post("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const row = await container.saleFollowService.follow(userId, id);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ data: { isFollowing: true } });
  });

  r.delete("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    await container.saleFollowService.unfollow(userId, id);
    return c.json({ data: { isFollowing: false } });
  });

  r.get("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const isFollowing = await container.saleFollowService.isFollowing(userId, id);
    return c.json({ data: { isFollowing } });
  });

  r.post("/", requireAuth, zValidator("json", createSaleSchema), async (c) => {
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    if (!roleHasCapability(role, "auction.manage", staff)) {
      return c.json({ error: "Only staff with auction.manage can create sales" }, 403);
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    try {
      const sale = await container.saleService.create(userId, body);
      return c.json(
        {
          data: await presentSaleImages(
            container.mediaUrlResolver,
            sale,
            container.mediaAssetEnricher,
          ),
        },
        201,
      );
    } catch (e) {
      if (e instanceof LotError) {
        return c.json({ error: e.message }, asHttpStatus(e.status));
      }
      throw e;
    }
  });

  r.patch(
    "/:id",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", updateSaleSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const result = await container.saleService.updateDraft(role, id, patch, staffRole);
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentSaleImages(
          container.mediaUrlResolver,
          result.value,
          container.mediaAssetEnricher,
        ),
      });
    },
  );

  r.post("/:id/publish", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staffRole = c.get("userStaffRole") ?? null;
    const { id } = c.req.valid("param");
    const result = await container.saleService.publish(userId, role, id, staffRole);
    if (result.isErr()) {
      return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
    }
    const data = await presentSalesWithLotsImages(container.mediaUrlResolver, [result.value]);
    return c.json({ data: data[0] });
  });

  r.post("/:id/unpublish", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staffRole = c.get("userStaffRole") ?? null;
    const { id } = c.req.valid("param");
    const result = await container.saleService.unpublish(userId, role, id, staffRole);
    if (result.isErr()) {
      return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
    }
    return c.json({
      data: await presentSaleImages(
        container.mediaUrlResolver,
        result.value,
        container.mediaAssetEnricher,
      ),
    });
  });

  r.post(
    "/:id/cancel",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", cancelSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const result = await container.saleService.cancel(userId, role, id, staffRole);
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentSaleImages(
          container.mediaUrlResolver,
          result.value,
          container.mediaAssetEnricher,
        ),
      });
    },
  );

  r.post(
    "/:id/delete",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", deleteSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const { confirmationPhrase } = c.req.valid("json");
      const result = await container.saleSoftDeleteService.softDelete(
        userId,
        role,
        id,
        confirmationPhrase,
        staffRole,
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.body(null, 204);
    },
  );

  r.post(
    "/:id/lots",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", createNestedLotForSaleSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.saleService.addLot(role, id, body, staffRole);
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json(
        {
          data: await presentLotImages(
            container.mediaUrlResolver,
            result.value,
            container.mediaAssetEnricher,
          ),
        },
        201,
      );
    },
  );

  r.post(
    "/:id/lots/attach/:lotId",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    zValidator("json", attachLotToSaleBodySchema.optional()),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id, lotId } = c.req.valid("param");
      const body = c.req.valid("json") ?? { via: "attach_endpoint" as const };
      const result = await container.saleService.attachExistingLot(
        role,
        id,
        lotId,
        staffRole,
        body.via,
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentLotImages(
          container.mediaUrlResolver,
          result.value,
          container.mediaAssetEnricher,
        ),
      });
    },
  );

  r.delete(
    "/:id/lots/:lotId",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id, lotId } = c.req.valid("param");
      const result = await container.saleService.detachLot(role, id, lotId, staffRole);
      return result.match(
        () => c.body(null, 204),
        (error) => c.json(serviceErrorJsonBody(error), asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/:id/mark-ended",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", markSaleEndedBodySchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const result = await container.saleStatusTransitionService.markOnsiteSaleEnded(
        role,
        id,
        reason,
        staffRole,
        userId,
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      const data = await presentSalesWithLotsImages(container.mediaUrlResolver, [result.value]);
      return c.json({ data: data[0] });
    },
  );

  r.post(
    "/:id/lots/:lotId/cancel",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    zValidator("json", cancelSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id, lotId } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const lot = await container.lotService.getById(lotId);
      if (!lot || lot.saleId !== id) {
        return c.json({ error: "Lot not found in this sale" }, 404);
      }
      const result = await container.lotService.cancel(
        userId,
        role,
        lotId,
        normalizeUserStaffRole(staffRole ?? undefined),
        reason?.trim() ? "admin_override" : "manual",
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentLotImages(
          container.mediaUrlResolver,
          result.value,
          container.mediaAssetEnricher,
        ),
      });
    },
  );

  r.post(
    "/:id/lots/:lotId/status",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    zValidator("json", updateLotStatusBodySchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id, lotId } = c.req.valid("param");
      const { status, reason } = c.req.valid("json");
      if (status === "cancelled") {
        const userId = c.get("userId") as string;
        const lot = await container.lotService.getById(lotId);
        if (!lot || lot.saleId !== id) {
          return c.json({ error: "Lot not found in this sale" }, 404);
        }
        const cancelResult = await container.lotService.cancel(
          userId,
          role,
          lotId,
          normalizeUserStaffRole(staffRole ?? undefined),
          reason?.trim() ? "admin_override" : "manual",
        );
        if (cancelResult.isErr()) {
          return c.json(
            serviceErrorJsonBody(cancelResult.error),
            asHttpStatus(cancelResult.error.status),
          );
        }
        return c.json({
          data: await presentLotImages(
            container.mediaUrlResolver,
            cancelResult.value,
            container.mediaAssetEnricher,
          ),
        });
      }
      const result = await container.saleStatusTransitionService.setLotStatus(
        role,
        id,
        lotId,
        status,
        reason,
        staffRole,
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentLotImages(
          container.mediaUrlResolver,
          result.value,
          container.mediaAssetEnricher,
        ),
      });
    },
  );

  return r;
}
