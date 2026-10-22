import { JWKS_PATH, normalizeIssuerUrl } from "@auction/identity-contracts";
import { verifyIdentityToken } from "@auction/identity-contracts/verify";
import { createFetchTokenEndpoint, mergeRefreshTokens } from "@auction/identity-rp";
import type { ShopAdminConfig } from "../config";
import type { Clock } from "../ports/clock";
import type { SessionStore, StaffSessionRecord } from "../ports/session-store";
import { exchangeForShopApiToken } from "./exchange-shop-api-token";

const REFRESH_SKEW_MS = 60_000;

export async function refreshStaffSessionIfNeeded(input: {
  config: ShopAdminConfig;
  sessions: SessionStore;
  clock: Clock;
  sessionId: string;
  session: StaffSessionRecord;
}): Promise<StaffSessionRecord> {
  if (input.session.accessTokenExpiresAtMs - input.clock.nowMs() > REFRESH_SKEW_MS) {
    return input.session;
  }
  return input.sessions.withRefreshLock(input.sessionId, async () => {
    const latest = await input.sessions.get(input.sessionId);
    if (!latest) {
      throw new Error("Unauthorized");
    }
    if (latest.accessTokenExpiresAtMs - input.clock.nowMs() > REFRESH_SKEW_MS) {
      return latest;
    }
    const tokenEndpoint = createFetchTokenEndpoint({
      tokenEndpointUrl: `${input.config.oidcInternalIssuer}/api/auth/oauth2/token`,
      auth: {
        kind: "basic",
        clientId: input.config.oidcClientId,
        clientSecret: input.config.oidcClientSecret,
      },
      timeoutMs: 15_000,
    });
    const token = await tokenEndpoint.requestToken(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: latest.refreshToken,
      }),
    );
    const merged = mergeRefreshTokens(
      { refreshToken: latest.refreshToken, idToken: latest.idToken },
      token,
      "shop",
    );
    const issuer = normalizeIssuerUrl(input.config.oidcIssuer);
    const jwksUrl = `${input.config.oidcInternalIssuer.replace(/\/+$/, "")}${JWKS_PATH}`;
    const verified = await verifyIdentityToken({
      token: merged.idToken,
      jwksUrl,
      issuer,
      audience: input.config.oidcClientId,
    });
    if (!verified) {
      throw new Error("Invalid id_token after refresh");
    }
    const authTime =
      typeof verified.payload.auth_time === "number" ? verified.payload.auth_time : latest.authTime;
    const acr = typeof verified.payload.acr === "string" ? verified.payload.acr : latest.acr;
    const shopApi = await exchangeForShopApiToken({
      config: input.config,
      idToken: merged.idToken,
    });
    const updated: StaffSessionRecord = {
      ...latest,
      idToken: merged.idToken,
      refreshToken: merged.refreshToken,
      accessToken: shopApi.accessToken,
      accessTokenExpiresAtMs: input.clock.nowMs() + shopApi.expiresInSeconds * 1000,
      authTime,
      acr,
    };
    await input.sessions.save(input.sessionId, updated, input.config.sessionTtlSeconds);
    return updated;
  });
}
