import { createHash } from "node:crypto";
import type { SubjectStatusReader } from "@auction/auth";
import { REGISTERED_OIDC_CLIENTS, type RegisteredOidcClientId } from "@auction/identity-contracts";
import { createLocalJWKSet, jwtVerify } from "jose";
import type { OauthTokenLookup, OauthTokenStore } from "./oauth-token-management.ports.js";

type JwksReader = {
  getJwks(): Promise<{ id: string; publicKey: string; alg?: string | undefined }[]>;
};

export type TokenIntrospection =
  | { active: false }
  | {
      active: true;
      client_id?: string;
      scope?: string;
      token_type: "Bearer";
      exp: number;
      iat: number;
      sub: string;
      aud?: string;
    };

function fingerprint(token: string): string {
  return `h1:${createHash("sha256").update(token).digest("base64url")}`;
}

function buildTokenLookup(input: {
  requesterClientId: RegisteredOidcClientId;
  token: string;
  tokenTypeHint?: string | undefined;
}): OauthTokenLookup {
  const candidates = [fingerprint(input.token), input.token];
  return {
    requesterClientId: input.requesterClientId,
    accessTokenCandidates: input.tokenTypeHint === "refresh_token" ? [] : candidates,
    refreshTokenCandidates: input.tokenTypeHint === "access_token" ? [] : candidates,
  };
}

export function isTokenOwnedByClient(
  tokenClientId: string,
  requesterClientId: RegisteredOidcClientId,
): boolean {
  return tokenClientId === requesterClientId;
}

export function canClientIntrospectAudience(
  requesterClientId: RegisteredOidcClientId,
  audience: string,
): boolean {
  return REGISTERED_OIDC_CLIENTS[requesterClientId].allowedResources.some(
    (resource) => resource === audience,
  );
}

export class OauthTokenManagementService {
  constructor(
    private readonly tokens: OauthTokenStore,
    private readonly subjectStatus: SubjectStatusReader,
    private readonly issuer: string,
    private readonly jwks: JwksReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async revoke(input: {
    requesterClientId: RegisteredOidcClientId;
    token: string;
    tokenTypeHint?: string | undefined;
  }): Promise<{ subjectId: string | null; refreshRevoked: boolean }> {
    const refreshAllowed = input.tokenTypeHint !== "access_token";
    const row = await this.tokens.findByClientAndToken(buildTokenLookup(input));
    if (!row || !isTokenOwnedByClient(row.clientId, input.requesterClientId)) {
      return { subjectId: null, refreshRevoked: false };
    }
    const isRefresh =
      refreshAllowed &&
      (row.refreshToken === input.token || row.refreshToken === fingerprint(input.token));
    if (isRefresh && row.refreshFamilyId) {
      await this.tokens.deleteRefreshFamily(row.refreshFamilyId);
    } else {
      await this.tokens.deleteToken(row.id);
    }
    return { subjectId: row.userId, refreshRevoked: isRefresh };
  }

  async introspect(input: {
    requesterClientId: RegisteredOidcClientId;
    token: string;
    tokenTypeHint?: string | undefined;
  }): Promise<TokenIntrospection> {
    const opaque = await this.introspectOpaque(input);
    if (opaque.active || !input.token.includes(".")) return opaque;
    return this.introspectJwt(input.requesterClientId, input.token);
  }

  private async introspectOpaque(input: {
    requesterClientId: RegisteredOidcClientId;
    token: string;
    tokenTypeHint?: string | undefined;
  }): Promise<TokenIntrospection> {
    const accessAllowed = input.tokenTypeHint !== "refresh_token";
    const row = await this.tokens.findByClientAndToken(buildTokenLookup(input));
    if (
      !row?.userId ||
      !isTokenOwnedByClient(row.clientId, input.requesterClientId) ||
      (await this.subjectStatus.isDisabledOrMerged(row.userId))
    ) {
      return { active: false };
    }
    const accessMatch =
      accessAllowed &&
      (row.accessToken === input.token || row.accessToken === fingerprint(input.token));
    const expiresAt = accessMatch ? row.accessTokenExpiresAt : row.refreshTokenExpiresAt;
    if (
      expiresAt.getTime() <= this.now().getTime() ||
      (!accessMatch && row.refreshConsumedAt !== null)
    ) {
      return { active: false };
    }
    return {
      active: true,
      client_id: row.clientId,
      scope: row.scopes,
      token_type: "Bearer",
      exp: Math.floor(expiresAt.getTime() / 1_000),
      iat: Math.floor(row.createdAt.getTime() / 1_000),
      sub: row.userId,
    };
  }

  private async introspectJwt(
    requesterClientId: RegisteredOidcClientId,
    token: string,
  ): Promise<TokenIntrospection> {
    try {
      const stored = await this.jwks.getJwks();
      const keys = stored.map((key) => ({
        ...(JSON.parse(key.publicKey) as Record<string, unknown>),
        kid: key.id,
        alg: key.alg ?? "RS256",
        use: "sig",
      }));
      const verified = await jwtVerify(token, createLocalJWKSet({ keys }), {
        issuer: this.issuer.replace(/\/+$/, ""),
        algorithms: ["RS256"],
      });
      const audience = typeof verified.payload.aud === "string" ? verified.payload.aud : undefined;
      const subject = verified.payload.sub;
      const exp = verified.payload.exp;
      const iat = verified.payload.iat;
      if (
        !audience ||
        !subject ||
        !exp ||
        !iat ||
        !canClientIntrospectAudience(requesterClientId, audience)
      ) {
        return { active: false };
      }
      if (await this.subjectStatus.isDisabledOrMerged(subject)) return { active: false };
      return {
        active: true,
        ...(typeof verified.payload.scope === "string" ? { scope: verified.payload.scope } : {}),
        token_type: "Bearer",
        exp,
        iat,
        sub: subject,
        aud: audience,
      };
    } catch {
      return { active: false };
    }
  }
}
