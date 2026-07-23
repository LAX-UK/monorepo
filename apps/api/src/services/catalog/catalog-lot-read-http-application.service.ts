import type { Database } from "@auction/db";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import {
  type Lot,
  type UserRole,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { isPublicCatalogLot, viewerCanSeeNonPublicCatalog } from "@auction/validators";
import { canManageCatalogue } from "../../lib/catalogue-auth.js";
import { listLotDocumentsPublic } from "../../lib/list-lot-documents-public.js";
import { computeLotCheckoutPricing } from "../../lib/lot-checkout-pricing.js";
import { maskLotForPublicView } from "../../lib/lot-public-view.js";
import { lotsWithCheckoutPricing } from "../../lib/lots-with-checkout-pricing.js";
import { mapLotToStaffListRow, mapLotToSummary } from "../../lib/mappers.js";
import { presentLotImages } from "../../lib/media-presenters.js";
import { buildConnectRequiredByLotId } from "../../lib/seller-connect-readiness.js";
import type { CachedCatalogueListService } from "../cached-catalogue-list.service.js";
import type { ICatalogLotReadHttpApplicationService } from "../interfaces/catalog-routes/catalog-lot-read-http.js";
import type {
  CatalogHttpJson,
  CatalogViewerContext,
} from "../interfaces/catalog-routes/catalog-read-http.js";
import type { ILotService } from "../interfaces/lot-service.js";
import type { ILotSoftDeleteService } from "../interfaces/lot-soft-delete.js";
import type { IMediaAssetEnricher } from "../interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";
import type { IObjectStorage } from "../interfaces/object-storage.js";
import type { ISaleService } from "../interfaces/sale-service.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";
import type { LotLifecycleQueryService } from "../lot-lifecycle-query.service.js";

export class CatalogLotReadHttpApplicationService implements ICatalogLotReadHttpApplicationService {
  constructor(
    private readonly lotService: ILotService,
    private readonly saleService: ISaleService,
    private readonly lotSoftDeleteService: ILotSoftDeleteService,
    private readonly lotLifecycleQueryService: LotLifecycleQueryService,
    private readonly cachedCatalogueListService: CachedCatalogueListService,
    private readonly stripeConnectService: IStripeConnectService,
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly mediaUrlResolver: IMediaUrlResolver,
    private readonly mediaAssetEnricher: IMediaAssetEnricher,
    private readonly db: Database,
    private readonly objectStorage: IObjectStorage,
  ) {}

  async listLots(input: {
    query: Parameters<ICatalogLotReadHttpApplicationService["listLots"]>[0]["query"];
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson> {
    const { query, viewer } = input;
    const viewerRole = normalizeUserRoleOrClient(viewer.role);
    const staff = normalizeUserStaffRole(viewer.staffRole ?? undefined);

    if (query.needsPhotos === "1" && !canManageCatalogue(viewerRole, staff)) {
      return { status: 403, body: { error: "Forbidden" } };
    }

    const buildPayload = async () => {
      const resolveImages = query.resolveImages !== "0";
      const { data } = await this.lotService.listLotsForPublicApi(
        {
          status: query.statuses ? undefined : query.status,
          statuses: query.statuses,
          categoryId: query.categoryId,
          categoryIds: query.categoryIds,
          sellerLegalEntityId: query.sellerId,
          winnerId: query.winnerId,
          saleId: query.saleId,
          artistId: query.artistId,
          endYear: query.endYear,
          search: query.q,
          endingWithinHours: query.endingWithinHours,
          sort: query.sort,
          limit: query.limit,
          offset: query.offset,
          ...(query.needsPhotos === "1" ? { needsPhotos: true } : {}),
          resolveImages,
        },
        viewer.role ?? undefined,
        viewer.staffRole ?? undefined,
      );
      const canSeeLifecycle =
        roleHasCapability(viewerRole, "catalogue.write", staff) ||
        roleHasCapability(viewerRole, "auction.manage", staff);
      let rows = data;
      if (canSeeLifecycle && data.length > 0) {
        const snapshots = await this.lotLifecycleQueryService.getSnapshotsForLots(
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
      if (roleHasCapability(viewerRole, "auction.manage", staff) && rows.length > 0) {
        const staffRows = rows as Lot[];
        const eligibilityByLot =
          await this.lotSoftDeleteService.getDeleteEligibilityBatch(staffRows);
        rows = staffRows.map((lotRow) => {
          if (lotRow.status !== "draft" && lotRow.status !== "scheduled") {
            return lotRow;
          }
          const deleteEligibility = eligibilityByLot.get(lotRow.id);
          return deleteEligibility ? { ...lotRow, deleteEligibility } : lotRow;
        });
      }

      if (canSeeLifecycle && rows.length > 0) {
        const staffRows = rows as Lot[];
        const connectEnforced = this.stripeConnectService.isConfigured();
        const connectByLot = await buildConnectRequiredByLotId(
          staffRows,
          this.legalEntityRepository,
          connectEnforced,
        );
        rows = staffRows.map((lotRow) => ({
          ...lotRow,
          connectRequired: connectByLot.get(lotRow.id) ?? false,
        }));
        return { data: (rows as Lot[]).map(mapLotToStaffListRow) };
      }

      const withPricing = await lotsWithCheckoutPricing({ saleService: this.saleService }, rows);
      return { data: withPricing.map(mapLotToSummary) };
    };

    const canUseCache = viewer.userId == null && query.needsPhotos !== "1";
    if (canUseCache) {
      const key = this.cachedCatalogueListService.buildKey("lots", query);
      const payload = await this.cachedCatalogueListService.getOrLoad(key, buildPayload);
      return { status: 200, body: payload };
    }

    return { status: 200, body: await buildPayload() };
  }

  async archiveSummary(input: { endYear?: number | undefined }): Promise<CatalogHttpJson> {
    const { total, count } = await this.lotService.archiveEndedSummary({
      endYear: input.endYear,
    });
    return {
      status: 200,
      body: { data: { totalHammer: total, endedLotCount: count } },
    };
  }

  async archiveCount(input: {
    categoryId?: string | undefined;
    categoryIds?: string[] | undefined;
    endYear?: number | undefined;
  }): Promise<CatalogHttpJson> {
    const count = await this.lotService.countMatching({
      status: "ended",
      categoryId: input.categoryId,
      categoryIds: input.categoryIds,
      endYear: input.endYear,
    });
    return { status: 200, body: { count } };
  }

  async countLots(input: {
    query: Parameters<ICatalogLotReadHttpApplicationService["countLots"]>[0]["query"];
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson> {
    const q = input.query;
    const viewerRole = (input.viewer.role ?? "client") as UserRole;
    const viewerStaffRole = normalizeUserStaffRole(input.viewer.staffRole as string | null);
    const canSeeNonPublic = viewerCanSeeNonPublicCatalog(viewerRole, viewerStaffRole);
    const count = await this.lotService.countMatching({
      ...(q.status ? { status: q.status } : {}),
      ...(q.statuses ? { statuses: q.statuses } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.categoryIds ? { categoryIds: q.categoryIds } : {}),
      ...(q.q ? { search: q.q } : {}),
      ...(q.endingWithinHours !== undefined ? { endingWithinHours: q.endingWithinHours } : {}),
      ...(q.endYear !== undefined ? { endYear: q.endYear } : {}),
      ...(canSeeNonPublic ? {} : { requirePublicParentSale: true }),
    });
    return { status: 200, body: { count } };
  }

  async getLotDetail(input: {
    lotId: string;
    viewer: CatalogViewerContext;
  }): Promise<CatalogHttpJson> {
    const lot = await this.lotService.getById(input.lotId);
    if (!lot) {
      return { status: 404, body: { error: "Not found" } };
    }
    const presented = await presentLotImages(this.mediaUrlResolver, lot, this.mediaAssetEnricher);
    const sale = lot.saleId ? await this.saleService.getById(lot.saleId) : null;
    const canPreview = viewerCanSeeNonPublicCatalog(
      input.viewer.role ?? undefined,
      input.viewer.staffRole,
    );
    if (!canPreview && !isPublicCatalogLot(presented, sale)) {
      return { status: 404, body: { error: "Not found" } };
    }
    const withPricing = {
      ...presented,
      checkoutPricing: computeLotCheckoutPricing(presented, sale),
    };
    const viewerRole = normalizeUserRoleOrClient(input.viewer.role);
    const staff = normalizeUserStaffRole(input.viewer.staffRole ?? undefined);
    const deleteEligibility = roleHasCapability(viewerRole, "auction.manage", staff)
      ? await this.lotSoftDeleteService.getDeleteEligibility(input.lotId)
      : null;
    return {
      status: 200,
      body: {
        data: {
          ...maskLotForPublicView(
            withPricing,
            input.viewer.role ?? undefined,
            input.viewer.staffRole,
          ),
          ...(deleteEligibility ? { deleteEligibility } : {}),
        },
      },
    };
  }

  async getWatchCount(input: { lotId: string }): Promise<CatalogHttpJson> {
    const result = await this.lotService.countWatchersForPublicApi(input.lotId);
    if (result.kind === "not_found") {
      return { status: 404, body: { error: "Not found" } };
    }
    return { status: 200, body: { data: { count: result.count } } };
  }

  async listLotDocuments(input: { lotId: string }): Promise<CatalogHttpJson> {
    const data = await listLotDocumentsPublic(
      this.db,
      this.objectStorage,
      this.mediaUrlResolver,
      input.lotId,
    );
    return { status: 200, body: { data } };
  }
}
