import { describe, expect, it } from "vitest";
import type { IdTokenContinuityRecord } from "../services/refreshed-id-token.service.js";
import {
  type ContinuityRedis,
  RedisIdTokenContinuityStore,
} from "./redis-id-token-continuity-store.js";

function fakeRedis() {
  const values = new Map<string, { value: string; ttlSec: number }>();
  const redis: ContinuityRedis = {
    set: async (key, value, _mode, ttlSec) => {
      values.set(key, { value, ttlSec });
      return "OK";
    },
    getdel: async (key) => {
      const entry = values.get(key);
      values.delete(key);
      return entry?.value ?? null;
    },
  };
  return { redis, values };
}

const record: IdTokenContinuityRecord = {
  issuer: "https://auth.example.test",
  sid: "sid-1",
  subject: "user-1",
  clientId: "lax-shop-admin",
  claims: { email: "staff@lax.test" },
};

describe("RedisIdTokenContinuityStore", () => {
  it("stores a record once, under the refresh token hash, for the given time", async () => {
    const { redis, values } = fakeRedis();
    const store = new RedisIdTokenContinuityStore(redis);

    await store.put("hash-1", record, 60);

    expect(values.get("auth:id-token-continuity:hash-1")?.ttlSec).toBe(60);
    await expect(store.take("hash-1")).resolves.toEqual(record);
    await expect(store.take("hash-1")).resolves.toBeNull();
  });

  it("seals records at rest when a sealer is configured", async () => {
    const { redis, values } = fakeRedis();
    const store = new RedisIdTokenContinuityStore(redis, {
      seal: (value) => `sealed:${Buffer.from(value).toString("base64")}`,
      open: (value) => Buffer.from(value.replace(/^sealed:/, ""), "base64").toString("utf8"),
    });

    await store.put("hash-1", record, 60);

    expect(values.get("auth:id-token-continuity:hash-1")?.value).not.toContain("staff@lax.test");
    await expect(store.take("hash-1")).resolves.toEqual(record);
  });

  it("treats an unreadable record as missing", async () => {
    const { redis, values } = fakeRedis();
    values.set("auth:id-token-continuity:hash-1", { value: "{not json", ttlSec: 60 });
    values.set("auth:id-token-continuity:hash-2", { value: '{"sid":1}', ttlSec: 60 });
    const store = new RedisIdTokenContinuityStore(redis);

    await expect(store.take("hash-1")).resolves.toBeNull();
    await expect(store.take("hash-2")).resolves.toBeNull();
  });
});
