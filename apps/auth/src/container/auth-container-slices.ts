import type { TokenExchangeService } from "../services/token-exchange.service.js";
import type { createOidcPhase3Services } from "./create-oidc-phase3-services.js";
import type { createSsfServices } from "./create-ssf-services.js";

export type AuthOidcServicesSlice = ReturnType<typeof createOidcPhase3Services> & {
  tokenExchange: TokenExchangeService;
};

export type AuthSsfServicesSlice = ReturnType<typeof createSsfServices>;

export type AuthRouteServicesSlice = {
  oidc: AuthOidcServicesSlice;
  ssf: AuthSsfServicesSlice;
};
