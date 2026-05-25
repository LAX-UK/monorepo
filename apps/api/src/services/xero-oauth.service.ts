import { randomBytes } from "node:crypto";
import type { Redis } from "ioredis";
import type { TokenSet } from "xero-node";
import type { Env } from "../env.js";
import { createXeroClientForOAuth } from "./accounting/xero-accounting.provider.js";
import { fetchAndCacheXeroOrganisationMetadata } from "./accounting/xero-organisation-metadata.js";
import type { IXeroConnectionRepository } from "./interfaces/xero-repositories.js";

function tokenExpiryFromSeconds(expiresAt: unknown): Date {
  if (expiresAt == null) return new Date(Date.now() + 25 * 60_000);
  const sec = typeof expiresAt === "number" ? expiresAt : Number.parseInt(String(expiresAt), 10);
  if (!Number.isFinite(sec)) return new Date(Date.now() + 25 * 60_000);
  return new Date(sec * 1000);
}

export class XeroOAuthService {
  constructor(
    private readonly redis: Redis,
    private readonly env: Pick<Env, "XERO_CLIENT_ID" | "XERO_CLIENT_SECRET" | "XERO_REDIRECT_URI">,
    private readonly connections: IXeroConnectionRepository,
  ) {}

  private stateKey(state: string): string {
    return `xero:oauth_state:${state}`;
  }

  async buildConsentUrlForUser(userId: string): Promise<string> {
    const state = randomBytes(24).toString("hex");
    await this.redis.setex(this.stateKey(state), 600, userId);
    const client = createXeroClientForOAuth(this.env, state);
    await client.initialize();
    return client.buildConsentUrl();
  }

  async completeOAuth(params: {
    userId: string;
    state: string;
    callbackFullUrl: string;
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    const stored = await this.redis.get(this.stateKey(params.state));
    if (!stored || stored !== params.userId) {
      return { ok: false, message: "Invalid or expired OAuth state" };
    }
    await this.redis.del(this.stateKey(params.state));

    const client = createXeroClientForOAuth(this.env, params.state);
    await client.initialize();
    let tokenSet: TokenSet;
    try {
      tokenSet = await client.apiCallback(params.callbackFullUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    }

    await client.updateTenants();
    const tenant = client.tenants[0] as { tenantId?: string; tenantName?: string } | undefined;
    if (!tenant?.tenantId) {
      return { ok: false, message: "No Xero organisation returned" };
    }

    const access = tokenSet.access_token;
    const refresh = tokenSet.refresh_token;
    if (!access || !refresh) {
      return { ok: false, message: "Missing tokens from Xero" };
    }

    await this.connections.upsertConnection({
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName ?? null,
      accessToken: access,
      refreshToken: refresh,
      expiresAt: tokenExpiryFromSeconds(tokenSet.expires_at),
      scopes: (() => {
        const sc = tokenSet.scope as unknown;
        if (sc == null) return null;
        if (typeof sc === "string") return sc;
        if (Array.isArray(sc)) return sc.join(" ");
        return String(sc);
      })(),
      connectedByUserId: params.userId,
    });

    await fetchAndCacheXeroOrganisationMetadata(client, tenant.tenantId, this.connections);

    return { ok: true };
  }

  async getConnectionSummary(): Promise<{
    connected: boolean;
    tenantId: string | null;
    tenantName: string | null;
    expiresAt: string | null;
  }> {
    const row = await this.connections.findLatest();
    if (!row) {
      return { connected: false, tenantId: null, tenantName: null, expiresAt: null };
    }
    return {
      connected: true,
      tenantId: row.tenantId,
      tenantName: row.tenantName ?? null,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async disconnect(): Promise<void> {
    await this.connections.deleteAll();
  }
}
