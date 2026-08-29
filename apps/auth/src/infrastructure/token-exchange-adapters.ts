import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  OidcClientKind,
  REGISTERED_OIDC_CLIENTS,
  type RegisteredOidcClientId,
} from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import { oauthApplication, user } from "@auction/identity-db/schema";
import { eq } from "drizzle-orm";
import { createLocalJWKSet, jwtVerify } from "jose";
import type { ConfidentialClientAuthenticator } from "../routes/token-exchange.routes.js";
import type {
  LogoutTokenClaims,
  LogoutTokenSigner,
} from "../services/backchannel-logout.service.js";
import type { TokenExchangePorts } from "../services/token-exchange.service.js";
import type { IdentityJwtSigner } from "./identity-jwt-signer.ports.js";
import type { JwksProvider } from "./jwks-provider.js";

export type { JwksProvider, StoredSigningJwk } from "./jwks-provider.js";

/** Keeps private JWK material inside the signing adapter boundary. */
export function createLogoutTokenSigner(signer: IdentityJwtSigner): LogoutTokenSigner {
  return {
    async signLogoutToken(claims: LogoutTokenClaims): Promise<string> {
      const { token } = await signer.sign({
        typ: "logout+jwt",
        issuer: claims.iss,
        audience: claims.aud,
        claims: {
          events: claims.events,
          ...(claims.sid ? { sid: claims.sid } : {}),
          ...(claims.sub ? { sub: claims.sub } : {}),
        },
        issuedAt: claims.iat,
        jwtId: claims.jti,
      });
      return token;
    },
  };
}

function safeSecretEquals(stored: string, supplied: string): boolean {
  const suppliedHash = createHash("sha256").update(supplied).digest("base64url");
  const a = Buffer.from(stored);
  const b = Buffer.from(suppliedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class DrizzleConfidentialClientAuthenticator implements ConfidentialClientAuthenticator {
  constructor(private readonly db: IdentityDatabase) {}

  async authenticate(
    clientId: string,
    clientSecret: string,
  ): Promise<RegisteredOidcClientId | null> {
    if (!(clientId in REGISTERED_OIDC_CLIENTS)) return null;
    const registeredId = clientId as RegisteredOidcClientId;
    if (REGISTERED_OIDC_CLIENTS[registeredId].kind !== OidcClientKind.Confidential) return null;
    const [application] = await this.db
      .select({
        clientSecret: oauthApplication.clientSecret,
        disabled: oauthApplication.disabled,
        type: oauthApplication.type,
      })
      .from(oauthApplication)
      .where(eq(oauthApplication.clientId, registeredId))
      .limit(1);
    if (
      !application ||
      application.disabled ||
      application.type !== "web" ||
      !application.clientSecret ||
      !safeSecretEquals(application.clientSecret, clientSecret)
    ) {
      return null;
    }
    return registeredId;
  }
}

export function createTokenExchangePorts(options: {
  db: IdentityDatabase;
  issuer: string;
  jwks: JwksProvider;
  signer: IdentityJwtSigner;
}): TokenExchangePorts {
  const issuer = options.issuer.replace(/\/+$/, "");
  return {
    async verifySubjectToken({ token, expectedAudience }) {
      try {
        const storedKeys = await options.jwks.getJwks();
        const keys = storedKeys.map((stored) => ({
          ...(JSON.parse(stored.publicKey) as Record<string, unknown>),
          kid: stored.id,
          alg: stored.alg ?? "RS256",
          use: "sig",
        }));
        const result = await jwtVerify(token, createLocalJWKSet({ keys }), {
          issuer,
          algorithms: ["RS256"],
        });
        // Token exchange is bound to the authenticated client that received the
        // source token. Arrays and multi-audience tokens are deliberately denied.
        if (!result.payload.sub || result.payload.aud !== expectedAudience) return null;
        return {
          subject: result.payload.sub,
          ...(typeof result.payload.sid === "string" ? { sid: result.payload.sid } : {}),
        };
      } catch {
        return null;
      }
    },
    async isSubjectActive(subject) {
      const [identity] = await options.db
        .select({
          id: user.id,
          disabledAt: user.identityDisabledAt,
          mergedInto: user.mergedIntoSubjectId,
        })
        .from(user)
        .where(eq(user.id, subject))
        .limit(1);
      return Boolean(identity && !identity.disabledAt && !identity.mergedInto);
    },
    async signAccessToken({ subject, sid, audience, scopes }) {
      const { token } = await options.signer.sign({
        typ: "at+jwt",
        issuer,
        audience,
        subject,
        jwtId: randomUUID(),
        expirationTime: `${ACCESS_TOKEN_TTL_SECONDS}s`,
        claims: {
          ...(scopes.length > 0 ? { scope: scopes.join(" ") } : {}),
          ...(sid ? { sid } : {}),
        },
      });
      return token;
    },
  };
}
