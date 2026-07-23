import type { IdentityRouteServices } from "./index.js";

type IdentityRoutePick<K extends keyof IdentityRouteServices> = {
  identityRoutes: Pick<IdentityRouteServices, K>;
};

export type IdentityAuthRoutesContainer = IdentityRoutePick<"accountSecurityHttp"> &
  Pick<
    import("../../../container.js").Container,
    "env" | "redis" | "authenticator" | "userSuspensionChecker" | "authDb"
  >;

export type IdentityLegalEntityRoutesContainer = IdentityRoutePick<"legalEntityHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;

export type IdentityLegalEntityMemberRoutesContainer = IdentityRoutePick<"legalEntityMemberHttp"> &
  Pick<
    import("../../../container.js").Container,
    "userSuspensionChecker" | "requireLegalEntityContext" | "userService"
  >;

export type IdentityOrganizationRoutesContainer = IdentityRoutePick<
  "organizationHttp" | "organizationOnboardingHttp"
> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker" | "orgModuleGate">;

export type IdentityOrganizationOnboardingRoutesContainer =
  IdentityRoutePick<"organizationOnboardingHttp"> &
    Pick<import("../../../container.js").Container, "userSuspensionChecker" | "orgModuleGate">;
