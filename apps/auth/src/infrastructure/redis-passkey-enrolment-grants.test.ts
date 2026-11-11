import { describe, expect, it } from "vitest";
import { passkeyCreatedKey } from "../services/passkey-enrolment-grant.js";
import { RedisPasskeyEnrolmentGrants } from "./redis-passkey-enrolment-grants.js";

function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    set: async (key: string, value: string) => {
      store.set(key, value);
    },
    get: async (key: string) => store.get(key) ?? null,
    getdel: async (key: string) => {
      const value = store.get(key) ?? null;
      store.delete(key);
      return value;
    },
  };
}

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
