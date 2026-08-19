import { AUTH_ROUTE_PATH } from "@auction/auth";
import type { MiddlewareHandler } from "hono";
import {
  type IRefreshTokenFamilyRepository,
  hashRefreshToken,
} from "../services/refresh-token-family.ports.js";
import { getOAuthTokenRequestContext } from "./oauth-token-request-context.js";

export type RefreshReplayRedis = {
  reserve(key: string, value: string, ttlSec: number): Promise<boolean>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttlSec: number): Promise<void>;
  delete(key: string): Promise<void>;
};

type ReplayMarker = {
  familyId: string;
  userId: string | null;
  createdAtMs: number;
  state: "pending" | "consumed";
  sealedResponse?: string;
};

function replayKey(rawToken: string): string {
  return `auth:refresh-used:${hashRefreshToken(rawToken)}`;
}

/**
 * RFC 9700 refresh-family reuse detection around Better Auth's token endpoint.
 *
 * A token is reserved before rotation to close the concurrency race, committed
 * only after Better Auth returns a new refresh token, and released on failure.
 * Reuse outside the retry grace revokes every token in the family.
 */
export function createRefreshReplayGateMiddleware(options: {
  replay: RefreshReplayRedis;
  families: IRefreshTokenFamilyRepository;
  graceMs?: number;
  now?: () => number;
  onOutcome?: (outcome: "rotated" | "retry_grace" | "reuse" | "failed") => void;
  retryResponseCrypto?: {
    seal(plaintext: string): string;
    open(sealed: string): string;
  };
}): MiddlewareHandler {
  const graceMs = options.graceMs ?? 5_000;
  const now = options.now ?? Date.now;
  return async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (!path.endsWith(`${AUTH_ROUTE_PATH}/oauth2/token`)) {
      await next();
      return;
    }

    if (c.req.method !== "POST") {
      await next();
      return;
    }

    const parsed = getOAuthTokenRequestContext(c);
    const grantType = parsed?.grantType ?? null;
    const refreshToken = parsed?.refreshToken ?? null;

    if (grantType !== "refresh_token" || !refreshToken) {
      await next();
      return;
    }

    const token = await options.families.findAndPrepare(refreshToken);
    if (!token) {
      await next();
      return;
    }

    const ttlSec = Math.max(1, Math.ceil((token.expiresAt.getTime() - now()) / 1000));
    const key = replayKey(refreshToken);
    const marker: ReplayMarker = {
      familyId: token.familyId,
      userId: token.userId,
      createdAtMs: now(),
      state: "pending",
    };
    const reserved = await options.replay.reserve(key, JSON.stringify(marker), ttlSec);

    if (!reserved) {
      const existingRaw = await options.replay.get(key);
      let existing: ReplayMarker | null = null;
      try {
        existing = existingRaw ? (JSON.parse(existingRaw) as ReplayMarker) : null;
      } catch {
        existing = null;
      }
      if (existing?.familyId === token.familyId && now() - existing.createdAtMs <= graceMs) {
        options.onOutcome?.("retry_grace");
        if (
          existing.state === "consumed" &&
          existing.sealedResponse &&
          options.retryResponseCrypto
        ) {
          return c.body(options.retryResponseCrypto.open(existing.sealedResponse), 200, {
            "Content-Type": "application/json",
          });
        }
        c.header("Retry-After", String(Math.max(1, Math.ceil(graceMs / 1000))));
        return c.json(
          {
            error: "temporarily_unavailable",
            error_description: "Refresh rotation is already in progress",
          },
          409,
        );
      }

      await options.families.revokeFamily(token.familyId, token.userId);
      options.onOutcome?.("reuse");
      return c.json({ error: "invalid_grant", error_description: "Refresh token reuse" }, 401);
    }

    try {
      await next();
      if (!c.res.ok) {
        await options.replay.delete(key);
        return;
      }

      const responseText = await c.res.clone().text();
      const responseBody = (JSON.parse(responseText) ?? null) as {
        refresh_token?: unknown;
      } | null;
      if (typeof responseBody?.refresh_token !== "string") {
        await options.replay.delete(key);
        return;
      }

      await options.families.completeRotation({
        consumedTokenId: token.tokenId,
        newRawToken: responseBody.refresh_token,
        familyId: token.familyId,
      });
      await options.replay.put(
        key,
        JSON.stringify({
          ...marker,
          createdAtMs: now(),
          state: "consumed",
          ...(options.retryResponseCrypto
            ? { sealedResponse: options.retryResponseCrypto.seal(responseText) }
            : {}),
        } satisfies ReplayMarker),
        ttlSec,
      );
      options.onOutcome?.("rotated");
    } catch (error) {
      await options.replay.delete(key);
      options.onOutcome?.("failed");
      throw error;
    }
  };
}
