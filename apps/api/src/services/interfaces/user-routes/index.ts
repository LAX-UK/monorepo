import type { TwoFactorPolicyService } from "../../security/two-factor-policy.service.js";
import type { StaffInvitationAcceptService } from "../../staff-invitation-accept.service.js";
import type { IUserAccountOnboardingHttpApplicationService } from "./user-account-onboarding-http.js";
import type { IUserCategoryInterestsHttpApplicationService } from "./user-category-interests-http.js";
import type { IUserDashboardHttpApplicationService } from "./user-dashboard-http.js";
import type { IUserNotificationsHttpApplicationService } from "./user-notifications-http.js";
import type { IUserPreferencesHttpApplicationService } from "./user-preferences-http.js";
import type { IUserProfileHttpApplicationService } from "./user-profile-http.js";
import type { IUserPublicHttpApplicationService } from "./user-public-http.js";
import type { IUserSecurityHttpApplicationService } from "./user-security-http.js";
import type { IUserWatchlistHttpApplicationService } from "./user-watchlist-http.js";

export type UserRouteServices = {
  categoryInterestsHttp: IUserCategoryInterestsHttpApplicationService;
  publicHttp: IUserPublicHttpApplicationService;
  dashboardHttp: IUserDashboardHttpApplicationService;
  watchlistHttp: IUserWatchlistHttpApplicationService;
  notificationsHttp: IUserNotificationsHttpApplicationService;
  preferencesHttp: IUserPreferencesHttpApplicationService;
  profileHttp: IUserProfileHttpApplicationService;
  accountOnboardingHttp: IUserAccountOnboardingHttpApplicationService;
  securityHttp: IUserSecurityHttpApplicationService;
  twoFactorRequirement: Pick<TwoFactorPolicyService, "readMyRequirement">;
  staffInvitationAccept: Pick<StaffInvitationAcceptService, "accept">;
};

export type {
  IUserCategoryInterestsHttpApplicationService,
  IUserDashboardHttpApplicationService,
  IUserNotificationsHttpApplicationService,
  IUserPreferencesHttpApplicationService,
  IUserProfileHttpApplicationService,
  IUserPublicHttpApplicationService,
  IUserSecurityHttpApplicationService,
  IUserWatchlistHttpApplicationService,
};
