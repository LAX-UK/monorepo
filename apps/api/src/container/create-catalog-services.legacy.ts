import type { PlatformCatalogLegalEntityIdProvider } from "../lib/platform-catalog-legal-entity.js";
import type { AdminLotBrowseService } from "../services/admin/admin-lot-browse.service.js";
import type { ArtistDeleteService } from "../services/artist-delete.service.js";
import type { ArtistProfileService } from "../services/artist-profile.service.js";
import type { CategoryService } from "../services/category.service.js";
import type { ConditionReportService } from "../services/condition-report.service.js";
import type { DashboardQueryService } from "../services/dashboard-query.service.js";
import type {
  IItemSubmissionAdminApi,
  IItemSubmissionSellerApi,
  IItemSubmissionService,
} from "../services/interfaces/item-submission-apis.js";
import type { ILotJobScheduler } from "../services/interfaces/job-scheduler.js";
import type { ILotSoftDeleteService } from "../services/interfaces/lot-soft-delete.js";
import type { IOnsiteEventAdminService } from "../services/interfaces/onsite-event-admin-service.js";
import type { IOnsiteEventPassService } from "../services/interfaces/onsite-event-pass-service.js";
import type { IOnsiteEventPublicRsvpService } from "../services/interfaces/onsite-event-public-rsvp-service.js";
import type { IOnsiteEventStaffCheckInService } from "../services/interfaces/onsite-event-staff-check-in-service.js";
import type { ISaleSoftDeleteService } from "../services/interfaces/sale-soft-delete.js";
import type { LotLifecycleQueryService } from "../services/lot-lifecycle-query.service.js";
import type { LotTransitionOrchestrator } from "../services/lot-transition-orchestrator.js";
import type { LotService } from "../services/lot.service.js";
import type { NotificationQueryService } from "../services/notification-query.service.js";
import type { PaddleService } from "../services/paddle.service.js";
import type { PressArchiveReadService } from "../services/press-archive-read.service.js";
import type { QrCodeAnalyticsService } from "../services/qr-code-analytics.service.js";
import type { QrCodeService } from "../services/qr-code.service.js";
import type { SaleBiddersService } from "../services/sale-bidders.service.js";
import type { SaleExpectedGuestsService } from "../services/sale-expected-guests.service.js";
import type { SaleFollowService } from "../services/sale-follow.service.js";
import type { SaleListReadService } from "../services/sale-list-read.service.js";
import type { SaleStatusTransitionService } from "../services/sale-status-transition.service.js";
import type { SaleService } from "../services/sale.service.js";
import type { SaleroomCheckInService } from "../services/saleroom-check-in.service.js";
import type { TelephoneBidBookingService } from "../services/telephone-bid-booking.service.js";
import type { VenueService } from "../services/venue.service.js";

/** @deprecated Prefer sub-slice types from create-*-services.ts for narrow deps. */
export type ContainerCatalogServicesLegacy = {
  lotJobScheduler: ILotJobScheduler;
  lotTransitionOrchestrator: LotTransitionOrchestrator;
  lotLifecycleQueryService: LotLifecycleQueryService;
  adminLotBrowseService: AdminLotBrowseService;
  qrCodeService: QrCodeService;
  qrCodeAnalytics: QrCodeAnalyticsService;
  telephoneBidBookingService: TelephoneBidBookingService;
  paddleService: PaddleService;
  saleroomCheckInService: SaleroomCheckInService;
  saleExpectedGuestsService: SaleExpectedGuestsService;
  onsiteEventPublicRsvpService: IOnsiteEventPublicRsvpService;
  onsiteEventAdminService: IOnsiteEventAdminService;
  onsiteEventPassService: IOnsiteEventPassService;
  onsiteEventStaffCheckInService: IOnsiteEventStaffCheckInService;
  lotService: LotService;
  conditionReportService: ConditionReportService;
  saleFollowService: SaleFollowService;
  resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  saleService: SaleService;
  saleListReadService: SaleListReadService;
  pressArchiveReadService: PressArchiveReadService;
  saleSoftDeleteService: ISaleSoftDeleteService;
  lotSoftDeleteService: ILotSoftDeleteService;
  saleStatusTransitionService: SaleStatusTransitionService;
  saleBiddersService: SaleBiddersService;
  itemSubmissionService: IItemSubmissionService;
  itemSubmissionSellerApi: IItemSubmissionSellerApi;
  itemSubmissionAdminApi: IItemSubmissionAdminApi;
  categoryService: CategoryService;
  venueService: VenueService;
  artistProfileService: ArtistProfileService;
  artistDeleteService: ArtistDeleteService;
  dashboardQueryService: DashboardQueryService;
  notificationQueryService: NotificationQueryService;
};
