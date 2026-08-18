import type { UserRouteServices } from "./index.js";

type UserRoutePick<K extends keyof UserRouteServices> = {
  userRoutes: Pick<UserRouteServices, K>;
};

export type UserAccountRoutesContainer = UserRoutePick<
  | "publicHttp"
  | "dashboardHttp"
  | "watchlistHttp"
  | "notificationsHttp"
  | "preferencesHttp"
  | "profileHttp"
  | "securityHttp"
> &
  Pick<
    import("../../../container.js").Container,
    "userSuspensionChecker" | "env" | "identityIssuer"
  >;
