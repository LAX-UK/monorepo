import { describe, expect, it, vi } from "vitest";
import { RedisRefreshReplayStore, checkAndRotateRefreshToken } from "./refresh-replay.js";

const TTL = 60;

/**
 * Minimal Redis mock that mirrors `SET key value NX EX ttl` semantics.
 * Returns "OK" on first write, null on subsequent writes (key already exists).
 */
function makeStore(seeded: Set<string> = new Set()) {
  const used = new Set<string>(seeded);
  const redis = {
    set: vi.fn(async (key: string, _value: string, _nx: "NX", _ex: "EX", _ttl: number) => {
      if (used.has(key)) return null;
      used.add(key);
      return "OK";
    }),
  };
  return { store: new RedisRefreshReplayStore(redis), redis, used };
}

describe("checkAndRotateRefreshToken", () => {
  it("returns ok on first use (no prior state)", async () => {
    const { store } = makeStore();
    const result = await checkAndRotateRefreshToken({
      store,
      sessionId: "sess-1",
      incomingToken: "tok-A",
      ttlSec: TTL,
    });
    expect(result.status).toBe("ok");
  });

  it("returns ok when a new (non-replayed) token is presented", async () => {
    const { store } = makeStore();
    // First use of tok-A → ok, marks tok-A as consumed
    await checkAndRotateRefreshToken({
      store,
      sessionId: "sess-1",
      incomingToken: "tok-A",
      ttlSec: TTL,
    });
    // tok-B is fresh (never consumed) → ok
    const result = await checkAndRotateRefreshToken({
      store,
      sessionId: "sess-1",
      incomingToken: "tok-B",
      ttlSec: TTL,
    });
    expect(result.status).toBe("ok");
  });

  it("detects replay when the same already-consumed token is presented again", async () => {
    const { store } = makeStore();
    // First use: consumes tok-A
    await checkAndRotateRefreshToken({
      store,
      sessionId: "sess-1",
      incomingToken: "tok-A",
      ttlSec: TTL,
    });
    // Attacker replays tok-A
    const result = await checkAndRotateRefreshToken({
      store,
      sessionId: "sess-1",
      incomingToken: "tok-A",
      ttlSec: TTL,
    });
    expect(result.status).toBe("replay_detected");
    if (result.status === "replay_detected") {
      expect(result.sessionId).toBe("sess-1");
    }
  });

  it("uses exactly one redis SET call per check (atomic — no separate EXISTS)", async () => {
    const { store, redis } = makeStore();
    await checkAndRotateRefreshToken({
      store,
      sessionId: "sess-1",
      incomingToken: "tok-A",
      ttlSec: TTL,
    });
    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining("auth:refresh-used:"),
      "1",
      "NX",
      "EX",
      TTL,
    );
  });
});
