import { type UserRole, normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import {
  listSaleBiddersQuerySchema,
  listSaleLotsQuerySchema,
  listSalesQuerySchema,
  saleIdParamSchema,
} from "@auction/validators";
import { canManageCatalogue } from "../../lib/catalogue-auth.js";
import { CATALOGUE_WRITE_CAPABILITIES } from "../../lib/errors.js";
import { respondMissingCapability } from "../../lib/forbidden-response.js";
import { buildConnectRequiredByLotId } from "../../lib/seller-connect-readiness.js";
import { zValidator } from "../../lib/z-validator.js";
import type { SaleHono, SaleReadRouteDeps } from "./_shared.js";

export function attachSaleReadRoutes(r: SaleHono, deps: SaleReadRouteDeps): void {
  const { container, optionalAuth, requireAuth } = deps;

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

  r.get("/:id/saleroom/status", zValidator("param", saleIdParamSchema), async (c) => {
    const { id: saleId } = c.req.valid("param");
    const data = await container.saleroomService.getPublicSessionStatus(saleId);
    return c.json({ data });
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
}
