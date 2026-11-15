import { describe, expect, it } from "vitest";
import { passkeyCreatedKey } from "../services/passkey-enrolment-grant.js";
import { RedisPasskeyEnrolmentGrants } from "./redis-passkey-enrolment-grants.js";

function fakeRedis() {
  const store = new Map<string, string>();
  const expiresAt = new Map<string, number>();
  let now = 0;
  const live = (key: string) => {
    const at = expiresAt.get(key);
    if (at !== undefined && at <= now) {
      store.delete(key);
      expiresAt.delete(key);
    }
    return store.get(key) ?? null;
  };
  return {
    store,
    expiresAt,
    advance: (ms: number) => {
      now += ms;
    },
    set: async (key: string, value: string, mode: string, ttl: number, flag?: string) => {
      if (flag === "NX" && live(key) !== null) return null;
      store.set(key, value);
      expiresAt.set(key, now + (mode === "EX" ? ttl * 1000 : ttl));
      return "OK";
    },
    get: async (key: string) => live(key),
    // Stands in for the spend script: value and remaining ms, then delete.
    eval: async (_script: string, _n: number, key: string) => {
      const value = live(key);
      if (value === null) return false;
      const pttl = (expiresAt.get(key) ?? now) - now;
      store.delete(key);
      expiresAt.delete(key);
      return [value, pttl];
    },
  };
}

describe("the permission to make a passkey", () => {
  it("is single use", async () => {
    const redis = fakeRedis();
    const grants = new RedisPasskeyEnrolmentGrants(redis);
    await grants.grant("sid-1", "u1");
    expect(await grants.spend("sid-1", "u2")).toBeNull();
    expect(await grants.spend("sid-1", "u1")).toBeNull();
  });

  it("reports what it had left when spent", async () => {
    const redis = fakeRedis();
    const grants = new RedisPasskeyEnrolmentGrants(redis);
    await grants.grant("sid-1", "u1");
    redis.advance(100_000);
    expect(await grants.spend("sid-1", "u1")).toEqual({ remainingMs: 200_000 });
    expect(await grants.spend("sid-1", "u1")).toBeNull();
  });

  it("is given back with the time it had left, never a fresh five minutes", async () => {
    const redis = fakeRedis();
    const grants = new RedisPasskeyEnrolmentGrants(redis);
    await grants.grant("sid-1", "u1");
    const issuedExpiry = redis.expiresAt.get([...redis.store.keys()][0] as string) as number;
    redis.advance(100_000);
    const spent = await grants.spend("sid-1", "u1");
    redis.advance(10_000);
    await grants.giveBack("sid-1", "u1", spent?.remainingMs ?? 0);
    const key = [...redis.store.keys()][0] as string;
    // Never beyond the original expiry (the attempt's own duration is not credited back).
    expect(redis.expiresAt.get(key) as number).toBeLessThanOrEqual(issuedExpiry + 10_000);
    expect(redis.expiresAt.get(key) as number).toBeLessThanOrEqual(110_000 + 200_000);
    expect(await grants.holds("sid-1", "u1")).toBe(true);
  });

  it("caps what is given back at the original five minutes", async () => {
    const redis = fakeRedis();
    const grants = new RedisPasskeyEnrolmentGrants(redis);
    await grants.giveBack("sid-1", "u1", 10 * 60 * 1000);
    expect(redis.expiresAt.get([...redis.store.keys()][0] as string)).toBe(300_000);
  });

  it("is not given back when almost nothing is left", async () => {
    const redis = fakeRedis();
    const grants = new RedisPasskeyEnrolmentGrants(redis);
    await grants.giveBack("sid-1", "u1", 500);
    await grants.giveBack("sid-1", "u1", 0);
    await grants.giveBack("sid-1", "u1", Number.NaN);
    expect(redis.store.size).toBe(0);
  });

  it("does not replace a permission the session already holds again", async () => {
    const redis = fakeRedis();
    const grants = new RedisPasskeyEnrolmentGrants(redis);
    await grants.grant("sid-1", "u1");
    redis.advance(250_000);
    await grants.giveBack("sid-1", "u1", 290_000);
    expect(redis.expiresAt.get([...redis.store.keys()][0] as string)).toBe(300_000);
  });

  it("does not outlive five minutes from issue across repeated failed attempts", async () => {
    const redis = fakeRedis();
    const grants = new RedisPasskeyEnrolmentGrants(redis);
    await grants.grant("sid-1", "u1");
    for (let i = 0; i < 5; i += 1) {
      redis.advance(30_000);
      const spent = await grants.spend("sid-1", "u1");
      expect(spent).not.toBeNull();
      await grants.giveBack("sid-1", "u1", spent?.remainingMs ?? 0);
    }
    expect(redis.expiresAt.get([...redis.store.keys()][0] as string)).toBe(300_000);
    redis.advance(150_000);
    expect(await grants.holds("sid-1", "u1")).toBe(false);
  });
});

describe("the passkey made in an enrolment", () => {
  it("is remembered for the session and person that made it, and nobody else", async () => {
    const redis = fakeRedis();
    const grants = new RedisPasskeyEnrolmentGrants(redis);
    await grants.noteCreated("sid-1", "u1", "pk-1");
    expect(await grants.createdPasskey("sid-1", "u1")).toBe("pk-1");
    expect(await grants.createdPasskey("sid-1", "u2")).toBeNull();
    expect(await grants.createdPasskey("sid-2", "u1")).toBeNull();
  });

  it("is null when nothing was made, or the stored value is unreadable", async () => {
    const redis = fakeRedis();
    const grants = new RedisPasskeyEnrolmentGrants(redis);
    expect(await grants.createdPasskey("sid-1", "u1")).toBeNull();
    redis.store.set(passkeyCreatedKey("sid-1"), "not json");
    expect(await grants.createdPasskey("sid-1", "u1")).toBeNull();
  });

  it("does not store the session id itself", async () => {
    const redis = fakeRedis();
    await new RedisPasskeyEnrolmentGrants(redis).noteCreated("sid-secret", "u1", "pk-1");
    expect([...redis.store.keys()].some((key) => key.includes("sid-secret"))).toBe(false);
  });
});
