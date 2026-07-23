import type { IEmailService } from "@auction/email";
import type { IAttributionStore } from "@auction/marketing-events";
import type { INotificationPreferenceRepository } from "@auction/persistence/interfaces";
import type { LotReadPort, SaleLookupPort } from "../container/container-slices.js";
import type { Env } from "../env.js";
import type { AccountDeletionEligibilityService } from "../services/account-deletion-eligibility.service.js";
import type { AddressService } from "../services/address.service.js";
import type { ArtistWatchlistService } from "../services/artist-watchlist.service.js";
import type { IAuthAuditPublisher } from "../services/interfaces/auth-audit-publisher.js";
import type { IConditionReportService } from "../services/interfaces/condition-report.js";
import type { IMarketingEventService } from "../services/interfaces/marketing-event-service.js";
import type { IMediaAssetEnricher } from "../services/interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "../services/interfaces/media-url-resolver.js";
import type { IPaymentBuyerService } from "../services/interfaces/payment-service.js";
import type { IPushSubscriptionRepository } from "../services/interfaces/push.js";
import type { UserRouteServices } from "../services/interfaces/user-routes/index.js";
import type { NotificationQueryService } from "../services/notification-query.service.js";
import type { ProfileService } from "../services/profile.service.js";
import type { RegistrationService } from "../services/registration.service.js";
import type { SavedSearchService } from "../services/saved-search.service.js";
import type { SessionRevocationService } from "../services/session-revocation.service.js";
import type { UiPreferenceService } from "../services/ui-preference.service.js";
import type { UserDashboardReadService } from "../services/user-dashboard-read.service.js";
import type { UserSecurityReadService } from "../services/user-security-read.service.js";
import type { UserService } from "../services/user.service.js";
import { UserDashboardHttpApplicationService } from "../services/user/user-dashboard-http-application.service.js";
import { UserNotificationsHttpApplicationService } from "../services/user/user-notifications-http-application.service.js";
import { UserPreferencesHttpApplicationService } from "../services/user/user-preferences-http-application.service.js";
import { UserProfileHttpApplicationService } from "../services/user/user-profile-http-application.service.js";
import { UserPublicHttpApplicationService } from "../services/user/user-public-http-application.service.js";
import { UserSecurityHttpApplicationService } from "../services/user/user-security-http-application.service.js";
import { UserWatchlistHttpApplicationService } from "../services/user/user-watchlist-http-application.service.js";
import type { WatchlistService } from "../services/watchlist.service.js";

export type CreateUserRouteServicesInput = {
  env: Pick<Env, "WEB_ORIGIN" | "DISABLE_NEW_USER_REGISTRATION">;
  registrationService: RegistrationService;
  marketingEventService: IMarketingEventService;
  attributionStore: IAttributionStore;
  marketingAttributionEnabled: boolean;
  userService: UserService;
  mediaUrlResolver: IMediaUrlResolver;
  conditionReportService: IConditionReportService;
  userDashboardReadService: UserDashboardReadService;
  lotService: LotReadPort;
  paymentBuyerService: IPaymentBuyerService;
  mediaAssetEnricher: IMediaAssetEnricher;
  saleService: SaleLookupPort;
  watchlistService: WatchlistService;
  artistWatchlistService: ArtistWatchlistService;
  savedSearchService: SavedSearchService;
  notificationQueryService: NotificationQueryService;
  vapidPublicKey: string | null;
  pushSubscriptionRepository: IPushSubscriptionRepository;
  notificationPreferenceRepository: INotificationPreferenceRepository;
  uiPreferenceService: UiPreferenceService;
  profileService: ProfileService;
  addressService: AddressService;
  sessionRevocation: SessionRevocationService;
  authAuditPublisher: IAuthAuditPublisher;
  userSecurityReadService: UserSecurityReadService;
  emailService: Pick<IEmailService, "enqueue">;
  accountDeletionEligibilityService: AccountDeletionEligibilityService;
};

export function createUserRouteServices(input: CreateUserRouteServicesInput): UserRouteServices {
  return {
    publicHttp: new UserPublicHttpApplicationService({
      env: input.env,
      registrationService: input.registrationService,
      marketingEventService: input.marketingEventService,
      attributionStore: input.attributionStore,
      marketingAttributionEnabled: input.marketingAttributionEnabled,
      userService: input.userService,
      mediaUrlResolver: input.mediaUrlResolver,
    }),
    dashboardHttp: new UserDashboardHttpApplicationService({
      conditionReportService: input.conditionReportService,
      userDashboardReadService: input.userDashboardReadService,
      lotService: input.lotService,
      paymentBuyerService: input.paymentBuyerService,
      mediaUrlResolver: input.mediaUrlResolver,
      mediaAssetEnricher: input.mediaAssetEnricher,
      saleService: input.saleService,
    }),
    watchlistHttp: new UserWatchlistHttpApplicationService({
      watchlistService: input.watchlistService,
      userDashboardReadService: input.userDashboardReadService,
      lotService: input.lotService,
      marketingEventService: input.marketingEventService,
      attributionStore: input.attributionStore,
      marketingAttributionEnabled: input.marketingAttributionEnabled,
      artistWatchlistService: input.artistWatchlistService,
      savedSearchService: input.savedSearchService,
    }),
    notificationsHttp: new UserNotificationsHttpApplicationService(input.notificationQueryService),
    preferencesHttp: new UserPreferencesHttpApplicationService({
      vapidPublicKey: input.vapidPublicKey,
      pushSubscriptionRepository: input.pushSubscriptionRepository,
      notificationPreferenceRepository: input.notificationPreferenceRepository,
      uiPreferenceService: input.uiPreferenceService,
    }),
    profileHttp: new UserProfileHttpApplicationService({
      profileService: input.profileService,
      addressService: input.addressService,
      uiPreferenceService: input.uiPreferenceService,
      mediaUrlResolver: input.mediaUrlResolver,
    }),
    securityHttp: new UserSecurityHttpApplicationService({
      sessionRevocation: input.sessionRevocation,
      authAuditPublisher: input.authAuditPublisher,
      userSecurityReadService: input.userSecurityReadService,
      userService: input.userService,
      emailService: input.emailService,
      accountDeletionEligibilityService: input.accountDeletionEligibilityService,
      attributionStore: input.attributionStore,
    }),
  };
}
