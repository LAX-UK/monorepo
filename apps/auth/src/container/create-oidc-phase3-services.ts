import { type IdentityDatabase, createDrizzleSubjectStatusReader } from "@auction/identity-db";
import type { Redis } from "ioredis";
import {
  DrizzleBackchannelLogoutDeliveryRepository,
  DrizzleRpLogoutRepository,
} from "../infrastructure/drizzle-backchannel-logout.adapters.js";
import { DrizzleOauthTokenStore } from "../infrastructure/drizzle-oauth-token-store.js";
import { HttpBackchannelLogoutDispatcher } from "../infrastructure/http-backchannel-logout.dispatcher.js";
import type { IdentityJwtSigner } from "../infrastructure/identity-jwt-signer.ports.js";
import type { JwksProvider } from "../infrastructure/jwks-provider.js";
import {
  DrizzleOidcRpSessionRepository,
  RedisOidcCodeCorrelationStore,
} from "../infrastructure/oidc-session-adapters.js";
import {
  DrizzleConfidentialClientAuthenticator,
  createLogoutTokenSigner,
} from "../infrastructure/token-exchange-adapters.js";
import { BackchannelLogoutDeliveryWorker } from "../services/backchannel-logout-delivery.worker.js";
import { BackchannelLogoutRevocationCoordinator } from "../services/backchannel-logout-revocation.service.js";
import { OauthTokenManagementService } from "../services/oauth-token-management.service.js";
import { OidcSessionCoordinator } from "../services/oidc-session-coordinator.js";

export function createOidcPhase3Services(options: {
  db: IdentityDatabase;
  redis: Redis;
  issuer: string;
  jwks: JwksProvider;
  identityJwtSigner: IdentityJwtSigner;
  recentStepUpMaxAgeSec: number;
  onBackchannelOutcome?: (outcome: "delivered" | "retry_scheduled" | "failed") => void;
}) {
  const signer = createLogoutTokenSigner(options.identityJwtSigner);
  const logout = new BackchannelLogoutRevocationCoordinator(
    new DrizzleRpLogoutRepository(options.db),
  );
  return {
    sessions: new OidcSessionCoordinator(
      new RedisOidcCodeCorrelationStore(options.redis),
      new DrizzleOidcRpSessionRepository(options.db),
      options.recentStepUpMaxAgeSec,
    ),
    confidentialClients: new DrizzleConfidentialClientAuthenticator(options.db),
    tokenManagement: new OauthTokenManagementService(
      new DrizzleOauthTokenStore(options.db),
      createDrizzleSubjectStatusReader(options.db),
      options.issuer,
      options.jwks,
    ),
    logout,
    logoutDelivery: new BackchannelLogoutDeliveryWorker(
      new DrizzleBackchannelLogoutDeliveryRepository(options.db),
      options.issuer,
      signer,
      new HttpBackchannelLogoutDispatcher(),
      undefined,
      options.onBackchannelOutcome,
    ),
  };
}
