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
  securityHttp: IUserSecurityHttpApplicationService;
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
