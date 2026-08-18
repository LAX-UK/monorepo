import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import {
  BidContextEnrichedAuthenticator,
  IdentityPrincipalAuthenticator,
} from "../infrastructure/bid-context-enriched-authenticator.js";
import { DrizzleBidUserContextLoader } from "../infrastructure/drizzle-bid-user-context.loader.js";
import { JwtAuthenticator } from "../infrastructure/jwt-authenticator.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export type CreateAuthenticatorInput = {
  env: Env;
  db: Database;
};

export function createContainerAuthenticator(input: CreateAuthenticatorInput): IAuthenticator {
  const { env, db } = input;
  const issuer = env.OIDC_ISSUER_URL;
  const internalBaseUrl = env.OIDC_INTERNAL_BASE_URL ?? issuer;
  const identityResolver = new JwtAuthenticator({
    issuer,
    jwksUrl: `${internalBaseUrl.replace(/\/$/, "")}/.well-known/jwks.json`,
    audience: env.JWT_AUDIENCE,
    allowLegacyLaxApiAudience: env.ALLOW_LEGACY_LAX_API_AUDIENCE,
    onLegacyAudienceAccepted: () => {
      console.warn(
        JSON.stringify({
          event: "identity_legacy_audience_accepted",
          audience: "lax-api",
          removalCriterion: "zero_acceptances_for_30_days",
        }),
      );
    },
  });
  const bidContextLoader = new DrizzleBidUserContextLoader(db);
  return new BidContextEnrichedAuthenticator(
    new IdentityPrincipalAuthenticator(identityResolver),
    bidContextLoader,
  );
}
