import { type TokenEndpoint, isIdentityRejected, mergeRefreshTokens } from "@auction/identity-rp";
import type { SessionStore, StaffSessionRecord } from "../ports/session-store";

const ACCESS_TOKEN_EXPIRY_SKEW_MS = 30_000;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 300;

function isFresh(record: StaffSessionRecord, nowMs: number): boolean {
  return record.accessTokenExpiresAtMs - ACCESS_TOKEN_EXPIRY_SKEW_MS > nowMs;
}

/**
 * Returns the live session, refreshing tokens once the access token expires.
 * The session ends when the issuer rejects the refresh (revoked, disabled, or expired grant);
 * an unreachable issuer keeps the current session rather than signing everyone out.
 */
export async function revalidateAccountSession(input: {
  sessionId: string;
  sessions: SessionStore;
  tokenEndpoint: TokenEndpoint;
  sessionTtlSeconds: number;
  nowMs?: () => number;
}): Promise<StaffSessionRecord | null> {
  const now = input.nowMs ?? Date.now;
  const record = await input.sessions.get(input.sessionId);
  if (!record || isFresh(record, now())) return record;

  return input.sessions.withRefreshLock(input.sessionId, async () => {
    const current = await input.sessions.get(input.sessionId);
    if (!current || isFresh(current, now())) return current;
    try {
      const token = await input.tokenEndpoint.requestToken(
        new URLSearchParams({ grant_type: "refresh_token", refresh_token: current.refreshToken }),
      );
      const merged = mergeRefreshTokens(current, token, "bid");
      const refreshed: StaffSessionRecord = {
        ...current,
        ...merged,
        accessToken: token.access_token,
        accessTokenExpiresAtMs:
          now() + (token.expires_in ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS) * 1000,
      };
      await input.sessions.save(input.sessionId, refreshed, input.sessionTtlSeconds);
      return refreshed;
    } catch (error) {
      if (isIdentityRejected(error)) {
        await input.sessions.delete(input.sessionId);
        return null;
      }
      return current;
    }
  });
}
