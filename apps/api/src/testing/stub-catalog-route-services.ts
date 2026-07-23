import { vi } from "vitest";
import type { CatalogRouteServices } from "../services/interfaces/catalog-routes/index.js";

export function stubCatalogRouteServices(
  overrides?: Partial<CatalogRouteServices>,
): CatalogRouteServices {
  return {
    lotReadHttp: {
      listLots: vi.fn(),
      archiveSummary: vi.fn(),
      archiveCount: vi.fn(),
      countLots: vi.fn(),
      getLotDetail: vi.fn(),
      getWatchCount: vi.fn(),
      listLotDocuments: vi.fn(),
    },
    saleReadHttp: {
      listSales: vi.fn(),
      getSaleroomStatus: vi.fn(),
      getSaleDetail: vi.fn(),
      getCatalogAdminDetail: vi.fn(),
      listSaleLotsPage: vi.fn(),
      listSaleBidders: vi.fn(),
    },
    categoryReadHttp: { listCategories: vi.fn() },
    pressReadHttp: {
      listCoverage: vi.fn(),
      listDayMedia: vi.fn(),
      getSitemapFreshness: vi.fn(),
    },
    saleLifecycleHttp: {
      bulkSoftDelete: vi.fn(),
      createSale: vi.fn(),
      updateDraft: vi.fn(),
      publish: vi.fn(),
      unpublish: vi.fn(),
      cancel: vi.fn(),
      softDelete: vi.fn(),
      markOnsiteSaleEnded: vi.fn(),
    },
    saleLotMembershipHttp: {
      addLot: vi.fn(),
      attachExistingLot: vi.fn(),
      detachLot: vi.fn(),
      cancelLotOnSale: vi.fn(),
      setLotStatus: vi.fn(),
    },
    lotLifecycleHttp: {
      bulkLots: vi.fn(),
      publish: vi.fn(),
      requestWithdrawal: vi.fn(),
      cancel: vi.fn(),
      softDelete: vi.fn(),
      update: vi.fn(),
      updateMarketingDetails: vi.fn(),
      create: vi.fn(),
    },
    saleFollowHttp: {
      follow: vi.fn(),
      unfollow: vi.fn(),
      getStatus: vi.fn(),
    },
    artistHttp: {
      search: vi.fn(),
      listPublic: vi.fn(),
      browsePublic: vi.fn(),
      checkNameAvailability: vi.fn(),
      proposeMatchesForAdmin: vi.fn(),
      getAliasesPublic: vi.fn(),
      getBySlug: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      addAlias: vi.fn(),
      mergeWithConfirmation: vi.fn(),
      review: vi.fn(),
      getDeleteEligibility: vi.fn(),
      delete: vi.fn(),
    },
    venueHttp: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
    },
    ...overrides,
  };
}
