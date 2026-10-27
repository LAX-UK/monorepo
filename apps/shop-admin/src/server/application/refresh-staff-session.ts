import { isIdentityRejected, mergeRefreshTokens } from "@auction/identity-rp";
import { StaffSessionEndedError } from "../domain/staff-session-ended";
import type { Clock } from "../ports/clock";
import type { SessionStore, StaffSessionRecord } from "../ports/session-store";
import type { StaffSessionRenewal } from "../ports/staff-session-renewal";

const REFRESH_SKEW_MS = 60_000;
/**
 * LAX Admin signs in against the same Identity issuer as LAX Bid and LAX Account, which may leave
 * `refresh_token` out of a refresh response; the previous one is then kept. ("shop" would reject
 * such a response: it is for the Shop identity service, which always sends both.)
 */
const REFRESH_RESPONSE_MODE = "bid";

function isFresh(session: StaffSessionRecord, nowMs: number): boolean {
  return session.accessTokenExpiresAtMs - nowMs > REFRESH_SKEW_MS;
}

async function renew(
  latest: StaffSessionRecord,
  renewal: StaffSessionRenewal,
  nowMs: () => number,
): Promise<StaffSessionRecord> {
  const token = await renewal.refresh(latest.refreshToken);
  if (!token.id_token) {
    // Shop API access is exchanged for the ID token, and the one held is past its lifetime.
    throw new StaffSessionEndedError("id_token_not_renewed");
  }
  const merged = mergeRefreshTokens(latest, token, REFRESH_RESPONSE_MODE);
  const verified = await renewal.verifyIdToken(merged.idToken);
  if (!verified) {
    throw new StaffSessionEndedError("renewal_failed", {
      cause: new Error("Renewed ID token did not verify"),
    });
  }
  const shopApi = await renewal.exchangeForShopApi(merged.idToken);
  return {
    ...latest,
    ...merged,
    accessToken: shopApi.accessToken,
    accessTokenExpiresAtMs: nowMs() + shopApi.expiresInSeconds * 1000,
    authTime: verified.authTime ?? latest.authTime,
    acr: verified.acr ?? latest.acr,
  };
}

/**
 * Returns the staff session with a usable Shop API token, renewing it shortly before it expires.
 * When it cannot be renewed the session ends with `StaffSessionEndedError`, which pages turn into
 * a sign-in that returns to the same page. A session the issuer refused is removed at once.
 */
export async function refreshStaffSessionIfNeeded(input: {
  sessions: SessionStore;
  renewal: StaffSessionRenewal;
  clock: Clock;
  sessionTtlSeconds: number;
  sessionId: string;
  session: StaffSessionRecord;
}): Promise<StaffSessionRecord> {
  if (isFresh(input.session, input.clock.nowMs())) {
    return input.session;
  }
  return input.sessions.withRefreshLock(input.sessionId, async () => {
    const latest = await input.sessions.get(input.sessionId);
    if (!latest) {
      throw new Error("Unauthorized");
    }
    if (isFresh(latest, input.clock.nowMs())) {
      return latest;
    }
    let updated: StaffSessionRecord;
    try {
      updated = await renew(latest, input.renewal, () => input.clock.nowMs());
    } catch (error) {
      if (error instanceof StaffSessionEndedError) {
        await input.sessions.delete(input.sessionId);
        throw error;
      }
      if (isIdentityRejected(error)) {
        await input.sessions.delete(input.sessionId);
        throw new StaffSessionEndedError("refresh_rejected", { cause: error });
      }
      throw new StaffSessionEndedError("renewal_failed", { cause: error });
    }
    await input.sessions.save(input.sessionId, updated, input.sessionTtlSeconds);
    return updated;
  });
}
