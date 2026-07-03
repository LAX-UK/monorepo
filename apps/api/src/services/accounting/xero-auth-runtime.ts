import type { Redis } from "ioredis";
import type { TokenSet } from "xero-node";
import type { XeroClient } from "xero-node";
import type {
  IXeroConnectionRepository,
  XeroConnectionRow,
} from "../interfaces/xero-repositories.js";
import { createXeroClientForOAuth } from "./xero-token.service.js";

export function tokenExpiryDate(tokenSet: TokenSet): Date {
  const raw = tokenSet.expires_at;
  if (raw == null) return new Date(Date.now() + 25 * 60_000);
  const sec = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(sec)) return new Date(Date.now() + 25 * 60_000);
  return new Date(sec * 1000);
}

export async function applyStoredTokens(xero: XeroClient, conn: XeroConnectionRow): Promise<void> {
  xero.setTokenSet({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken,
    expires_at: Math.floor(conn.expiresAt.getTime() / 1000),
  } as TokenSet);
}

export const XERO_REFRESH_LOCK_PREFIX = "xero:refresh:";
const XERO_REFRESH_LOCK_TTL_SEC = 30;
const REFRESH_SKEW_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RefreshXeroTokensOptions = {
  redis?: Redis;
  /** When true, refresh even if the access token is not close to expiry (keeps refresh token alive). */
  force?: boolean;
};

async function persistRefreshedTokens(
  xero: XeroClient,
  connections: IXeroConnectionRepository,
  conn: XeroConnectionRow,
  refreshed: TokenSet,
): Promise<XeroConnectionRow> {
  const exp = tokenExpiryDate(refreshed);
  await connections.updateTokens(conn.tenantId, {
    accessToken: refreshed.access_token ?? conn.accessToken,
    refreshToken: refreshed.refresh_token ?? conn.refreshToken,
    expiresAt: exp,
  });
  await connections.updateConnectionStatus(conn.tenantId, "healthy", null);
  const next = await connections.findLatest();
  if (!next) throw new Error("Xero connection missing after refresh");
  await applyStoredTokens(xero, next);
  return next;
}

/** Refreshes OAuth tokens when close to expiry; persists new tokens on the connection row. */
export async function refreshXeroTokensIfNeeded(
  xero: XeroClient,
  connections: IXeroConnectionRepository,
  conn: XeroConnectionRow,
  options?: RefreshXeroTokensOptions,
): Promise<XeroConnectionRow> {
  if (!options?.force && conn.expiresAt.getTime() > Date.now() + REFRESH_SKEW_MS) {
    return conn;
  }

  const doRefresh = async (): Promise<XeroConnectionRow> => {
    try {
      const refreshed = await xero.refreshToken();
      return await persistRefreshedTokens(xero, connections, conn, refreshed);
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      await connections.updateConnectionStatus(conn.tenantId, "needs_reauth", msg);
      throw cause;
    }
  };

  const redis = options?.redis;
  if (!redis) {
    return doRefresh();
  }

  const lockKey = `${XERO_REFRESH_LOCK_PREFIX}${conn.tenantId}`;
  const lockOk = await redis.set(lockKey, "1", "EX", XERO_REFRESH_LOCK_TTL_SEC, "NX");
  if (lockOk !== "OK") {
    for (let i = 0; i < 12; i++) {
      await sleep(250);
      const latest = await connections.findLatest();
      if (!latest) throw new Error("Xero connection missing");
      if (latest.expiresAt.getTime() > Date.now() + REFRESH_SKEW_MS) {
        await applyStoredTokens(xero, latest);
        return latest;
      }
    }
    return doRefresh();
  }

  try {
    return await doRefresh();
  } finally {
    await redis.del(lockKey);
  }
}

/** Proactive refresh for cron — keeps the refresh token alive on idle environments. */
export async function proactiveRefreshXeroTokens(input: {
  env: Pick<
    import("../../env.js").Env,
    "XERO_CLIENT_ID" | "XERO_CLIENT_SECRET" | "XERO_REDIRECT_URI"
  >;
  connections: IXeroConnectionRepository;
  redis: Redis;
}): Promise<{ ok: true; tenantId: string } | { ok: false; reason: string }> {
  const conn = await input.connections.findLatest();
  if (!conn) {
    return { ok: false, reason: "not_connected" };
  }

  const xero = createXeroClientForOAuth(input.env);
  await xero.initialize();
  await applyStoredTokens(xero, conn);

  try {
    await refreshXeroTokensIfNeeded(xero, input.connections, conn, {
      redis: input.redis,
      force: true,
    });
    return { ok: true, tenantId: conn.tenantId };
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, reason: msg };
  }
}
