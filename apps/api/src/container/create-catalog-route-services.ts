import type { Database } from "@auction/db";
import type { ILegalEntityRepository, IRepositoryFactory } from "@auction/persistence/interfaces";
import type { ArtistDeleteService } from "../services/artist-delete.service.js";
import type { ArtistProfileService } from "../services/artist-profile.service.js";
import type { CachedCatalogueListService } from "../services/cached-catalogue-list.service.js";
import { CatalogArtistHttpApplicationService } from "../services/catalog/catalog-artist-http-application.service.js";
import { CatalogCategoryReadHttpApplicationService } from "../services/catalog/catalog-category-read-http-application.service.js";
import { CatalogLotLifecycleHttpApplicationService } from "../services/catalog/catalog-lot-lifecycle-http-application.service.js";
import { CatalogLotReadHttpApplicationService } from "../services/catalog/catalog-lot-read-http-application.service.js";
import { CatalogPressReadHttpApplicationService } from "../services/catalog/catalog-press-read-http-application.service.js";
import { CatalogSaleFollowHttpApplicationService } from "../services/catalog/catalog-sale-follow-http-application.service.js";
import { CatalogSaleLifecycleHttpApplicationService } from "../services/catalog/catalog-sale-lifecycle-http-application.service.js";
import { CatalogSaleLotMembershipHttpApplicationService } from "../services/catalog/catalog-sale-lot-membership-http-application.service.js";
import { CatalogSaleReadHttpApplicationService } from "../services/catalog/catalog-sale-read-http-application.service.js";
import { CatalogVenueHttpApplicationService } from "../services/catalog/catalog-venue-http-application.service.js";
import { LotLifecycleTransitionExecutor } from "../services/catalog/lot-lifecycle-transition-executor.service.js";
import type { IArtistRegistryService } from "../services/interfaces/artist-registry.js";
import type { CatalogRouteServices } from "../services/interfaces/catalog-routes/index.js";
import type { ICategoryService } from "../services/interfaces/category-service.js";
import type { ILotService } from "../services/interfaces/lot-service.js";
import type { ILotSoftDeleteService } from "../services/interfaces/lot-soft-delete.js";
import type { IMediaAssetEnricher } from "../services/interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "../services/interfaces/media-url-resolver.js";
import type { IObjectStorage } from "../services/interfaces/object-storage.js";
import type { IPressArchiveReadService } from "../services/interfaces/press-archive-read.service.js";
import type { ISaleService } from "../services/interfaces/sale-service.js";
import type { ISaleSoftDeleteService } from "../services/interfaces/sale-soft-delete.js";
import type { ISaleStatusTransitionService } from "../services/interfaces/sale-status-transition.js";
import type { SaleroomServicePort } from "../services/interfaces/saleroom-service.js";
import type { IStripeConnectService } from "../services/interfaces/stripe-connect.js";
import type { LotLifecycleQueryService } from "../services/lot-lifecycle-query.service.js";
import type { SaleBiddersService } from "../services/sale-bidders.service.js";
import type { SaleFollowService } from "../services/sale-follow.service.js";
import type { SaleListReadService } from "../services/sale-list-read.service.js";
import type { VenueService } from "../services/venue.service.js";

export type CreateCatalogRouteServicesInput = {
  saleService: ISaleService;
  saleSoftDeleteService: ISaleSoftDeleteService;
  saleStatusTransitionService: ISaleStatusTransitionService;
  lotService: ILotService;
  lotSoftDeleteService: ILotSoftDeleteService;
  mediaUrlResolver: IMediaUrlResolver;
  mediaAssetEnricher: IMediaAssetEnricher;
  db: Database;
  objectStorage: IObjectStorage;
  cachedCatalogueListService: CachedCatalogueListService;
  lotLifecycleQueryService: LotLifecycleQueryService;
  stripeConnectService: IStripeConnectService;
  legalEntityRepository: ILegalEntityRepository;
  saleListReadService: SaleListReadService;
  repoFactory: IRepositoryFactory;
  saleroomService: SaleroomServicePort;
  saleBiddersService: SaleBiddersService;
  categoryService: ICategoryService;
  pressArchiveReadService: IPressArchiveReadService;
  saleFollowService: SaleFollowService;
  artistRegistryService: IArtistRegistryService;
  artistProfileService: ArtistProfileService;
  artistDeleteService: ArtistDeleteService;
  venueService: VenueService;
};

export function createCatalogRouteServices(
  input: CreateCatalogRouteServicesInput,
): CatalogRouteServices {
  const lotLifecycleTransitionExecutor = new LotLifecycleTransitionExecutor(
    input.saleStatusTransitionService,
    input.lotService,
  );

  return {
    lotReadHttp: new CatalogLotReadHttpApplicationService(
      input.lotService,
      input.saleService,
      input.lotSoftDeleteService,
      input.lotLifecycleQueryService,
      input.cachedCatalogueListService,
      input.stripeConnectService,
      input.legalEntityRepository,
      input.mediaUrlResolver,
      input.mediaAssetEnricher,
      input.db,
      input.objectStorage,
    ),
    saleReadHttp: new CatalogSaleReadHttpApplicationService(
      input.saleListReadService,
      input.cachedCatalogueListService,
      input.repoFactory,
      input.saleSoftDeleteService,
      input.saleService,
      input.saleroomService,
      input.stripeConnectService,
      input.legalEntityRepository,
      input.saleBiddersService,
    ),
    categoryReadHttp: new CatalogCategoryReadHttpApplicationService(input.categoryService),
    pressReadHttp: new CatalogPressReadHttpApplicationService(input.pressArchiveReadService),
    saleLifecycleHttp: new CatalogSaleLifecycleHttpApplicationService(
      input.saleService,
      input.saleSoftDeleteService,
      input.saleStatusTransitionService,
      input.mediaUrlResolver,
      input.mediaAssetEnricher,
    ),
    saleLotMembershipHttp: new CatalogSaleLotMembershipHttpApplicationService(
      input.saleService,
      input.lotService,
      lotLifecycleTransitionExecutor,
      input.mediaUrlResolver,
      input.mediaAssetEnricher,
    ),
    lotLifecycleHttp: new CatalogLotLifecycleHttpApplicationService(
      input.lotService,
      input.lotSoftDeleteService,
      lotLifecycleTransitionExecutor,
      input.mediaUrlResolver,
      input.mediaAssetEnricher,
    ),
    saleFollowHttp: new CatalogSaleFollowHttpApplicationService(input.saleFollowService),
    artistHttp: new CatalogArtistHttpApplicationService(
      input.artistRegistryService,
      input.artistProfileService,
      input.artistDeleteService,
    ),
    venueHttp: new CatalogVenueHttpApplicationService(input.venueService),
  };
}
