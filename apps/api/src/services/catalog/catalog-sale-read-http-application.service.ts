import type { ILegalEntityRepository, IRepositoryFactory } from "@auction/persistence/interfaces";
import {
  NO_STAFF_ROLES,
  SALE_ADMIN_DETAIL_ACCESS,
  type UserRole,
  requirementCapabilities,
  roleHasCapability,
} from "@auction/types";
import { canReadSaleAdminDetail } from "../../lib/catalogue-auth.js";
import { missingCapabilityBody } from "../../lib/forbidden-response.js";
import { buildConnectRequiredByLotId } from "../../lib/seller-connect-readiness.js";
import type { CachedCatalogueListService } from "../cached-catalogue-list.service.js";
import type {
  CatalogHttpJson,
  CatalogViewerContext,
} from "../interfaces/catalog-routes/catalog-read-http.js";
import type { ICatalogSaleReadHttpApplicationService } from "../interfaces/catalog-routes/catalog-sale-read-http.js";
import type { ISaleService } from "../interfaces/sale-service.js";
import type { ISaleSoftDeleteService } from "../interfaces/sale-soft-delete.js";
import type { SaleroomServicePort } from "../interfaces/saleroom-service.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";
import type { SaleBiddersService } from "../sale-bidders.service.js";
import type { SaleListReadService } from "../sale-list-read.service.js";
import type { ISaleResultsSummaryService } from "../sale-results-summary.service.js";

export class CatalogSaleReadHttpApplicationService
  implements ICatalogSaleReadHttpApplicationService
{
  constructor(
    private readonly saleListReadService: SaleListReadService,
    private readonly cachedCatalogueListService: CachedCatalogueListService,
    private readonly repoFactory: IRepositoryFactory,
    private readonly saleSoftDeleteService: ISaleSoftDeleteService,
    private readonly saleService: ISaleService,
    private readonly saleroomService: SaleroomServicePort,
    private readonly stripeConnectService: IStripeConnectService,
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly saleBiddersService: SaleBiddersService,
    private readonly saleResults: ISaleResultsSummaryService,
  ) {}

  async listSales(input: {
    query: Parameters<ICatalogSaleReadHttpApplicationService["listSales"]>[0]["query"];
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson> {
    const query = input.query;
    const staff = input.viewer.staffRoles;
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
      input.viewer.role != null &&
      roleHasCapability(input.viewer.role as UserRole, "auction.manage", staff);

    const buildPublicPayload = async () => {
      const { data: rows } = await this.saleListReadService.listForPublicApi(listFilter, {
        role: input.viewer.role ?? undefined,
        staffRoles: staff,
      });
      return {
        data: rows.map(({ sale, lotCount, previewLots, resultsSummary }) => ({
          sale,
          lots: previewLots,
          lotCount,
          resultsSummary,
        })),
      };
    };

    if (!canEnrichDelete) {
      if (input.viewer.userId == null) {
        const key = this.cachedCatalogueListService.buildKey("sales", query);
        const payload = await this.cachedCatalogueListService.getOrLoad(key, buildPublicPayload);
        return { status: 200, body: payload };
      }
      return { status: 200, body: await buildPublicPayload() };
    }

    const { data: rows } = await this.saleListReadService.listForPublicApi(listFilter, {
      role: input.viewer.role ?? undefined,
      staffRoles: staff,
    });

    const data = await (async () => {
      const draftScheduled = rows.filter(
        (row) => row.sale.status === "draft" || row.sale.status === "scheduled",
      );
      const lotsBySale =
        draftScheduled.length > 0
          ? await this.repoFactory.root.lot.findBySaleIds(draftScheduled.map((row) => row.sale.id))
          : [];
      const lotsBySaleId = new Map<string, typeof lotsBySale>();
      for (const lot of lotsBySale) {
        if (!lot.saleId) continue;
        const arr = lotsBySaleId.get(lot.saleId) ?? [];
        arr.push(lot);
        lotsBySaleId.set(lot.saleId, arr);
      }
      const eligibilityBySale = await this.saleSoftDeleteService.getDeleteEligibilityBatch(
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

    return {
      status: 200,
      body: {
        data: data.map(({ sale, previewLots, lotCount, ...rest }) => ({
          sale,
          lots: previewLots,
          lotCount,
          ...rest,
        })),
      },
    };
  }

  async getSaleroomStatus(input: { saleId: string }): Promise<CatalogHttpJson> {
    const data = await this.saleroomService.getPublicSessionStatus(input.saleId);
    return { status: 200, body: { data } };
  }

  async getSaleDetail(input: {
    saleId: string;
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson> {
    const detail = await this.saleService.getSaleDetailForPublicApi(
      input.saleId,
      input.viewer.userId ?? undefined,
      {
        role: input.viewer.role ?? undefined,
        staffRoles: input.viewer.staffRoles,
      },
    );
    if (!detail) return { status: 404, body: { error: "Not found" } };
    const summaries = await this.saleResults.summarise([detail.data.sale]);
    return {
      status: 200,
      body: {
        data: { ...detail.data, resultsSummary: summaries.get(detail.data.sale.id) ?? null },
      },
    };
  }

  async getCatalogAdminDetail(input: {
    saleId: string;
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson> {
    const role = (input.viewer.role ?? "client") as UserRole;
    const staff = input.viewer.staffRoles;
    if (!canReadSaleAdminDetail(role, staff)) {
      return {
        status: 403,
        body: missingCapabilityBody(
          "Only catalogue, saleroom or read-only staff can view catalogue admin detail",
          requirementCapabilities(SALE_ADMIN_DETAIL_ACCESS),
          { role, staffRoles: staff ?? NO_STAFF_ROLES },
        ),
      };
    }
    const detail = await this.saleService.getSaleDetailForCatalogAdmin(input.saleId);
    if (!detail) return { status: 404, body: { error: "Not found" } };
    const connectEnforced = this.stripeConnectService.isConfigured();
    const connectByLot = await buildConnectRequiredByLotId(
      detail.data.lots,
      this.legalEntityRepository,
      connectEnforced,
    );
    const lotsWithConnect = detail.data.lots.map((lotRow) => ({
      ...lotRow,
      connectRequired: connectByLot.get(lotRow.id) ?? false,
    }));
    const deleteEligibility = roleHasCapability(role, "auction.manage", staff)
      ? await this.saleSoftDeleteService.getDeleteEligibility(input.saleId)
      : null;
    return {
      status: 200,
      body: {
        data: {
          ...detail.data,
          lots: lotsWithConnect,
          ...(deleteEligibility ? { deleteEligibility } : {}),
        },
      },
    };
  }

  async listSaleLotsPage(input: {
    saleId: string;
    query: Parameters<ICatalogSaleReadHttpApplicationService["listSaleLotsPage"]>[0]["query"];
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson> {
    const page = await this.saleService.listSaleLotsPageForPublicApi(
      input.saleId,
      {
        limit: input.query.limit,
        offset: input.query.offset,
        sort: input.query.sort,
      },
      { role: input.viewer.role ?? undefined, staffRoles: input.viewer.staffRoles },
    );
    if (!page) return { status: 404, body: { error: "Not found" } };
    return { status: 200, body: page };
  }

  async listSaleBidders(input: {
    saleId: string;
    query: Parameters<ICatalogSaleReadHttpApplicationService["listSaleBidders"]>[0]["query"];
  }): Promise<CatalogHttpJson> {
    const page = await this.saleBiddersService.list(input.saleId, {
      limit: input.query.limit,
      offset: input.query.offset,
    });
    if (!page) return { status: 404, body: { error: "Not found" } };
    return {
      status: 200,
      body: {
        data: {
          items: page.items.map((b) => ({
            maskedName: b.maskedName,
            firstBidAt: b.firstBidAt,
          })),
          total: page.total,
          limit: input.query.limit,
          offset: input.query.offset,
        },
      },
    };
  }
}
