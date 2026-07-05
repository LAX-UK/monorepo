import type { PlatformCatalogLegalEntityIdProvider } from "../../lib/platform-catalog-legal-entity.js";
import type { ArtistProfileService } from "../artist-profile.service.js";
import type { CategoryService } from "../category.service.js";
import type { AdminCatalogRouteServices } from "../interfaces/admin-routes/admin-catalog-routes.js";
import type { IArtistRegistryService } from "../interfaces/artist-registry.js";
import type { IConditionReportService } from "../interfaces/condition-report.js";
import type { ILotFulfilmentService } from "../interfaces/lot-fulfilment-service.js";
import type { ILotService } from "../interfaces/lot-service.js";
import type { ISaleRegistrationService } from "../interfaces/sale-registration-service.js";
import type { LotLifecycleQueryService } from "../lot-lifecycle-query.service.js";
import type { LotTransitionOrchestrator } from "../lot-transition-orchestrator.js";
import type { MediaAssetEnricher } from "../media-asset-enricher.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { QrCodeAnalyticsService } from "../qr-code-analytics.service.js";
import type { QrCodeService } from "../qr-code.service.js";
import { AdminCatalogApplicationService } from "./admin-catalog-application.service.js";
import { AdminConditionReportsApplicationService } from "./admin-condition-reports-application.service.js";
import type { AdminLotBrowseService } from "./admin-lot-browse.service.js";
import { AdminLotFulfilmentApplicationService } from "./admin-lot-fulfilment-application.service.js";
import { AdminLotsApplicationService } from "./admin-lots-application.service.js";
import { AdminQrCodesApplicationService } from "./admin-qr-codes-application.service.js";
import { AdminSaleRegistrationsApplicationService } from "./admin-sale-registrations-application.service.js";

export type CreateAdminCatalogServicesInput = {
  categoryService: CategoryService;
  artistProfileService: ArtistProfileService;
  artistRegistryService: IArtistRegistryService;
  resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  lotService: ILotService;
  adminLotBrowseService: AdminLotBrowseService;
  lotTransitionOrchestrator: LotTransitionOrchestrator;
  lotLifecycleQueryService: LotLifecycleQueryService;
  saleRegistrationService: ISaleRegistrationService;
  lotFulfilmentService: ILotFulfilmentService;
  qrCodeService: QrCodeService;
  qrCodeAnalytics: QrCodeAnalyticsService;
  conditionReportService: IConditionReportService;
  mediaUrlResolver: MediaUrlResolver;
  mediaAssetEnricher: MediaAssetEnricher;
};

export function createAdminCatalogServices(
  input: CreateAdminCatalogServicesInput,
): AdminCatalogRouteServices {
  return {
    catalog: new AdminCatalogApplicationService(
      input.categoryService,
      input.artistProfileService,
      input.artistRegistryService,
      input.resolvePlatformCatalogLegalEntityId,
    ),
    lots: new AdminLotsApplicationService(
      input.lotService,
      input.adminLotBrowseService,
      input.lotTransitionOrchestrator,
      input.lotLifecycleQueryService,
    ),
    saleRegistrations: new AdminSaleRegistrationsApplicationService(input.saleRegistrationService),
    lotFulfilment: new AdminLotFulfilmentApplicationService(input.lotFulfilmentService),
    qrCodes: new AdminQrCodesApplicationService(input.qrCodeService, input.qrCodeAnalytics),
    conditionReports: new AdminConditionReportsApplicationService(
      input.conditionReportService,
      input.mediaUrlResolver,
      input.mediaAssetEnricher,
    ),
  };
}
