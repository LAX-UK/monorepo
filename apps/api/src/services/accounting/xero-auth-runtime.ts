import type { TokenSet } from "xero-node";
import type { XeroClient } from "xero-node";
import type { IXeroConnectionRepository, XeroConnectionRow } from "../interfaces/xero-repositories.js";

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

/** Refreshes OAuth tokens when close to expiry; persists new tokens on the connection row.
 */
export async function refreshXeroTokensIfNeeded(
  xero: XeroClient,
  connections: IXeroConnectionRepository,
  conn: XeroConnectionRow,
): Promise<XeroConnectionRow> {
  const skewMs = 120_000;
  if (conn.expiresAt.getTime() > Date.now() + skewMs) {
    return conn;
  }
  const refreshed = await xero.refreshToken();
  const exp = tokenExpiryDate(refreshed);
  await connections.updateTokens(conn.tenantId, {
    accessToken: refreshed.access_token ?? conn.accessToken,
    refreshToken: refreshed.refresh_token ?? conn.refreshToken,
    expiresAt: exp,
  });
  const next = await connections.findLatest();
  if (!next) throw new Error("Xero connection missing after refresh");
  xero.setTokenSet({
    access_token: next.accessToken,
    refresh_token: next.refreshToken,
    expires_at: Math.floor(next.expiresAt.getTime() / 1000),
  } as TokenSet);
  return next;
}
