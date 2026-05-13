/**
 * Refresh-token replay detection.
 *
 * After a token is rotated (incoming RT consumed → new RT issued), the SHA-256
 * hash of the consumed token is stored in Redis. If the same token is presented
 * again before it expires the session is considered compromised (RFC 6819 §5.2.2.3
 * token-rotation with reuse detection).
 *
 * ## Atomicity
 * The check-and-mark operation uses a single `SET key 1 NX EX ttl` command.
 * This removes the TOCTOU race that existed when `EXISTS` and `SET` were two
 * separate round-trips: under concurrent requests, both could win the `EXISTS`
 * check before either wrote the key, letting a replayed token slip through.
 *
 * ## Wiring gap (as of 2026-05)
 * `checkAndRotateRefreshToken` is **not yet wired** into Better Auth's OIDC
 * token-refresh path. Better Auth does not expose a pre-rotation hook that
 * carries the raw incoming refresh token, so the integration requires either
 * a middleware intercept on `POST /oidc/token?grant_type=refresh_token` or
 * waiting for Better Auth to add a first-class hook.
 * Until wired, the store is safe to keep — it just isn't exercised in prod.
 *
 * Integration: call `checkAndRotateRefreshToken` inside the token-refresh handler
 * before returning a new access/refresh token pair.
 *
 * @module refresh-replay
 */

import { createHash } from "node:crypto";

export interface RefreshReplayStore {
  /**
   * Atomically mark a token hash as consumed with a TTL.
   *
   * Returns `true`  when the key was newly written (first use — token is valid).
   * Returns `false` when the key already existed  (replay detected).
   *
   * Implementations MUST use a single atomic operation (e.g. `SET NX EX`) to
   * avoid the check-then-set TOCTOU race.
   */
  tryMarkConsumed(key: string, ttlSec: number): Promise<boolean>;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function replayKey(tokenHash: string): string {
  return `auth:refresh-used:${tokenHash}`;
}

export type RefreshReplayResult =
  | { status: "ok" }
  | { status: "replay_detected"; sessionId: string };

/**
 * Atomically check the incoming refresh token for replay, then mark it consumed.
 *
 * - If the incoming token's hash is already marked consumed → replay detected.
 * - Otherwise, mark the incoming token as consumed (atomically) and return ok.
 */
export async function checkAndRotateRefreshToken(opts: {
  store: RefreshReplayStore;
  sessionId: string;
  incomingToken: string;
  /** TTL for the consumed-token marker — aligns with refresh token lifetime. */
  ttlSec: number;
}): Promise<RefreshReplayResult> {
  const incomingHash = hashToken(opts.incomingToken);
  const key = replayKey(incomingHash);

  const isFirstUse = await opts.store.tryMarkConsumed(key, opts.ttlSec);
  if (!isFirstUse) {
    return { status: "replay_detected", sessionId: opts.sessionId };
  }
  return { status: "ok" };
}

/** Redis-backed implementation of {@link RefreshReplayStore}. */
export class RedisRefreshReplayStore implements RefreshReplayStore {
  constructor(
    private readonly redis: {
      /**
       * SET key value NX EX ttl
       * Returns "OK" when the key was newly written, null when it already existed.
       */
      set(key: string, value: string, nx: "NX", ex: "EX", ttl: number): Promise<string | null>;
    },
  ) {}

  async tryMarkConsumed(key: string, ttlSec: number): Promise<boolean> {
    const result = await this.redis.set(key, "1", "NX", "EX", ttlSec);
    return result === "OK";
  }
}
