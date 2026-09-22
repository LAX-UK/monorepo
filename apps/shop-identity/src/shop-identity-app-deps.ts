import type {
  CompleteOAuthCallbackInput,
  CompleteOAuthCallbackResult,
} from "./application/complete-oauth-callback.handler.js";
import type { ShopUserProfileReadModel } from "./application/ports/oauth-callback.ports.js";
import type { ShopIdentityTokenService } from "./application/shop-identity-token.service.js";
import type { ShopIdentityEnv } from "./env.js";
import type { OidcDiscovery } from "./oidc.js";
import type { LogoutToken, ShopSessionRepository } from "./session.js";

export type ShopIdentityAppDeps = {
  env: ShopIdentityEnv;
  release: string;
  sessionRepository: ShopSessionRepository;
  tokenService: ShopIdentityTokenService;
  discovery: OidcDiscovery;
  secureCookies: boolean;
  findShopProfile(identitySubjectId: string): Promise<ShopUserProfileReadModel | null>;
  checkDatabase(): Promise<void>;
  checkIdentityProvider(): Promise<void>;
  completeOAuthCallback(input: CompleteOAuthCallbackInput): Promise<CompleteOAuthCallbackResult>;
  verifyLogoutToken(token: string): Promise<LogoutToken | null>;
};
