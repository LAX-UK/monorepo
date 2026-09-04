import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BidBffSessionStore,
  decryptSession,
  encryptSession,
  generateSessionId,
} from "./session-store.server";

function required(value: string | undefined): string {
  if (!value) throw new Error("Missing fake Redis argument");
  return value;
}

class FakeRedis {
  status = "ready";
  values = new Map<string, string>();
  sets = new Map<string, Set<string>>();
  expiresAt = new Map<string, number>();
  rejectNx = false;
  rejectRotate = false;

  private purge(key: string) {
    const expiry = this.expiresAt.get(key);
    if (expiry !== undefined && expiry <= Date.now()) {
      this.values.delete(key);
      this.sets.delete(key);
      this.expiresAt.delete(key);
    }
  }

  private has(key: string) {
    this.purge(key);
    return this.values.has(key) || this.sets.has(key);
  }

  async set(key: string, value: string, ...args: unknown[]) {
    if (args.includes("NX") && (this.rejectNx || this.has(key))) return null;
    if (args.includes("XX") && !this.has(key)) return null;
    this.values.set(key, value);
    const pxIndex = args.indexOf("PX");
    if (pxIndex >= 0) this.expiresAt.set(key, Date.now() + Number(args[pxIndex + 1]));
    return "OK";
  }
  async get(key: string) {
    this.purge(key);
    return this.values.get(key) ?? null;
  }
  async del(...keys: string[]) {
    let deleted = 0;
    for (const key of keys) {
      if (this.values.delete(key) || this.sets.delete(key)) deleted += 1;
      this.expiresAt.delete(key);
    }
    return deleted;
  }
  async eval(script: string, keyCount: number, ...parameters: unknown[]) {
    const keys = parameters.slice(0, keyCount) as string[];
    const args = parameters.slice(keyCount).map(String);
    if (script.includes("bff:locked-write-session")) {
      const [sessionKey, refsKey, firstIndex, secondIndex, lockKey] = keys;
      const [encrypted, ttl, member, lockOwner] = args;
      if (
        !sessionKey ||
        !refsKey ||
        !firstIndex ||
        !secondIndex ||
        !lockKey ||
        !encrypted ||
        !ttl ||
        !member ||
        !lockOwner
      ) {
        throw new Error("Invalid locked-write-session test invocation");
      }
      if ((await this.get(lockKey)) !== lockOwner || !this.has(sessionKey)) return 0;
      this.removeMemberships(refsKey, member);
      this.values.set(sessionKey, encrypted);
      this.expiresAt.set(sessionKey, Date.now() + Number(ttl) * 1_000);
      this.addMemberships(refsKey, [firstIndex, secondIndex], member, Number(ttl));
      return 1;
    }
    if (script.includes("bff:write-session")) {
      const [sessionKey, refsKey, ...indexes] = keys;
      const [encrypted, ttl, member, mode] = args;
      if (!sessionKey || !refsKey || !encrypted || !ttl || !member || !mode) {
        throw new Error("Invalid write-session test invocation");
      }
      if ((mode === "NX" && this.has(sessionKey)) || (mode === "XX" && !this.has(sessionKey))) {
        return 0;
      }
      this.removeMemberships(refsKey, member);
      this.values.set(sessionKey, encrypted);
      this.expiresAt.set(sessionKey, Date.now() + Number(ttl) * 1_000);
      this.addMemberships(refsKey, indexes, member, Number(ttl));
      return 1;
    }
    if (script.includes("bff:rotate-session")) {
      const [pendingKey, pendingRefs, sessionKey, refsKey, ...indexes] = keys;
      const [encrypted, pendingMember, ttl, member] = args;
      if (
        !pendingKey ||
        !pendingRefs ||
        !sessionKey ||
        !refsKey ||
        !encrypted ||
        !pendingMember ||
        !ttl ||
        !member
      ) {
        throw new Error("Invalid rotate-session test invocation");
      }
      if (this.rejectRotate || !this.has(pendingKey) || this.has(sessionKey)) return 0;
      this.removeMemberships(pendingRefs, pendingMember);
      await this.del(pendingKey, pendingRefs);
      this.values.set(sessionKey, encrypted);
      this.expiresAt.set(sessionKey, Date.now() + Number(ttl) * 1_000);
      this.addMemberships(refsKey, indexes, member, Number(ttl));
      return 1;
    }
    if (script.includes("bff:delete-session")) {
      const sessionKey = required(keys[0]);
      const refsKey = required(keys[1]);
      this.removeMemberships(refsKey, required(args[0]));
      await this.del(refsKey);
      return this.del(sessionKey);
    }
    if (script.includes("bff:invalidate-index")) {
      const indexKey = required(keys[0]);
      const sessionPrefix = required(args[0]);
      const members = [...(this.sets.get(indexKey) ?? [])];
      let deleted = 0;
      for (const member of members) {
        const sessionKey = `${sessionPrefix}${member}`;
        const refsKey = `${sessionKey}:indexes`;
        this.removeMemberships(refsKey, member);
        await this.del(refsKey);
        deleted += await this.del(sessionKey);
      }
      await this.del(indexKey);
      return deleted;
    }
    if (script.includes("pexpire")) {
      const lockKey = required(keys[0]);
      if ((await this.get(lockKey)) !== args[0]) return 0;
      this.expiresAt.set(lockKey, Date.now() + Number(args[1]));
      return 1;
    }
    if (script.includes("redis.call('del', KEYS[1])")) {
      const lockKey = required(keys[0]);
      if ((await this.get(lockKey)) !== args[0]) return 0;
      return this.del(lockKey);
    }
    throw new Error(`Unsupported test script: ${script}`);
  }

  private removeMemberships(refsKey: string, member: string) {
    for (const indexKey of this.sets.get(refsKey) ?? []) {
      const index = this.sets.get(indexKey);
      index?.delete(member);
      if (index?.size === 0) this.sets.delete(indexKey);
    }
    this.sets.delete(refsKey);
  }

  private addMemberships(refsKey: string, indexes: string[], member: string, ttl: number) {
    const refs = new Set<string>();
    for (const indexKey of indexes) {
      const index = this.sets.get(indexKey) ?? new Set<string>();
      index.add(member);
      this.sets.set(indexKey, index);
      this.expiresAt.set(indexKey, Date.now() + ttl * 1_000);
      refs.add(indexKey);
    }
    this.sets.set(refsKey, refs);
    this.expiresAt.set(refsKey, Date.now() + ttl * 1_000);
  }
}

function authenticated(subject = "user-1", sid = "sid-1") {
  return {
    kind: "authenticated" as const,
    subject,
    sid,
    idToken: "id-token",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accessTokenExpiresAt: Date.now() + 60_000,
    resourceTokens: {},
  };
}

describe("BidBffSessionStore", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("OIDC_ISSUER_URL", "http://localhost:3003");
    vi.stubEnv("OIDC_CLIENT_SECRET_LAX_BID_WEB", "client-secret");
    vi.stubEnv("BID_BFF_SESSION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64url"));
  });

  it("encrypts OAuth material at rest", () => {
    const encrypted = encryptSession({
      kind: "pending",
      state: "state-secret",
      nonce: "nonce-secret",
      codeVerifier: "verifier-secret",
      nextPath: "/dashboard",
    });
    expect(encrypted).not.toContain("state-secret");
    expect(decryptSession(encrypted)).toMatchObject({ state: "state-secret" });
  });

  it("uses an opaque raw cookie id but only its fingerprint as the Redis key", async () => {
    const redis = new FakeRedis();
    const id = await new BidBffSessionStore(redis as never).createPending({
      kind: "pending",
      state: "s",
      nonce: "n",
      codeVerifier: "v",
      nextPath: "/",
    });
    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...redis.values.keys()].join()).not.toContain(id);
    await expect(new BidBffSessionStore(redis as never).read(id)).resolves.toMatchObject({
      kind: "pending",
    });
  });

  it("generates independent 256-bit session identifiers", () => {
    expect(generateSessionId()).not.toBe(generateSessionId());
  });

  it("fails explicitly when Redis rejects pending-session allocation", async () => {
    const redis = new FakeRedis();
    redis.rejectNx = true;
    await expect(
      new BidBffSessionStore(redis as never).createPending({
        kind: "pending",
        state: "s",
        nonce: "n",
        codeVerifier: "v",
        nextPath: "/",
      }),
    ).rejects.toThrow("Unable to allocate a unique BFF session");
  });

  it("indexes multiple sessions without exposing sid or subject and invalidates all matches", async () => {
    const redis = new FakeRedis();
    const store = new BidBffSessionStore(redis as never);
    const ids = await Promise.all([
      store.createPending({
        kind: "pending",
        state: "1",
        nonce: "n",
        codeVerifier: "v",
        nextPath: "/",
      }),
      store.createPending({
        kind: "pending",
        state: "2",
        nonce: "n",
        codeVerifier: "v",
        nextPath: "/",
      }),
    ]);
    await Promise.all(
      ids.map((id) => store.authenticate(id, authenticated("private-sub", "private-sid"))),
    );

    const redisKeys = [...redis.values.keys(), ...redis.sets.keys()].join(" ");
    expect(redisKeys).not.toContain("private-sub");
    expect(redisKeys).not.toContain("private-sid");
    await store.invalidateBySidOrSubject({ sid: "private-sid" });
    await expect(Promise.all(ids.map((id) => store.read(id)))).resolves.toEqual([null, null]);
  });

  it("moves index memberships when an authenticated identity changes", async () => {
    const redis = new FakeRedis();
    const store = new BidBffSessionStore(redis as never);
    const id = await store.createPending({
      kind: "pending",
      state: "s",
      nonce: "n",
      codeVerifier: "v",
      nextPath: "/",
    });
    await store.authenticate(id, authenticated("old-sub", "old-sid"));
    await store.updateAuthenticated(id, authenticated("new-sub", "new-sid"));

    await store.invalidateBySidOrSubject({ sid: "old-sid" });
    await expect(store.read(id)).resolves.toMatchObject({ sid: "new-sid" });
    await store.invalidateBySidOrSubject({ sub: "new-sub" });
    await expect(store.read(id)).resolves.toBeNull();
  });

  it("keeps the pending session when atomic authenticated rotation is rejected", async () => {
    const redis = new FakeRedis();
    const store = new BidBffSessionStore(redis as never);
    const pendingId = await store.createPending({
      kind: "pending",
      state: "s",
      nonce: "n",
      codeVerifier: "v",
      nextPath: "/",
    });
    redis.rejectRotate = true;

    await expect(store.rotateAuthenticated(pendingId, authenticated())).resolves.toBeNull();
    await expect(store.read(pendingId)).resolves.toMatchObject({ kind: "pending" });
  });

  it("cleans stale index members when their session has already expired", async () => {
    const redis = new FakeRedis();
    const store = new BidBffSessionStore(redis as never);
    const id = await store.createPending({
      kind: "pending",
      state: "s",
      nonce: "n",
      codeVerifier: "v",
      nextPath: "/",
    });
    await store.authenticate(id, authenticated("stale-sub", "stale-sid"));
    const storedSessionKey = [...redis.values.keys()].find(
      (key) => key.startsWith("bid:bff:session:") && !key.endsWith(":refresh"),
    );
    if (!storedSessionKey) throw new Error("Expected stored session");
    redis.values.delete(storedSessionKey);

    await store.invalidateBySidOrSubject({ sid: "stale-sid" });

    expect(redis.sets.size).toBe(0);
  });

  it("renews refresh-lock ownership beyond the original TTL", async () => {
    vi.useFakeTimers();
    try {
      const store = new BidBffSessionStore(new FakeRedis() as never);
      const result = store.withRefreshLock(generateSessionId(), async ({ assertOwned }) => {
        await new Promise((resolve) => setTimeout(resolve, 25_000));
        await assertOwned();
        return "renewed";
      });

      await vi.advanceTimersByTimeAsync(25_000);
      await expect(result).resolves.toBe("renewed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("prevents a stale refresh-lock owner from persisting session state", async () => {
    const redis = new FakeRedis();
    const store = new BidBffSessionStore(redis as never);
    const id = await store.createPending({
      kind: "pending",
      state: "s",
      nonce: "n",
      codeVerifier: "v",
      nextPath: "/",
    });
    await store.authenticate(id, authenticated());
    const staleSession = { ...authenticated(), accessToken: "stale-access-token" };

    const staleWrite = store.withRefreshLock(id, async (lock) => {
      const lockKey = [...redis.values.keys()].find((key) => key.endsWith(":refresh"));
      if (!lockKey) throw new Error("Expected refresh lock");
      redis.values.set(lockKey, "replacement-owner");
      expect(await lock.updateAuthenticated(staleSession)).toBe(false);
    });

    await expect(staleWrite).rejects.toThrow("Lost ownership of BFF token refresh lock");
    await expect(store.read(id)).resolves.toMatchObject({ accessToken: "access-token" });
  });

  it("serializes contending refresh operations under owned locks", async () => {
    const redis = new FakeRedis();
    const store = new BidBffSessionStore(redis as never);
    const id = generateSessionId();
    let active = 0;
    let maximumActive = 0;
    const operation = () =>
      store.withRefreshLock(id, async ({ assertOwned }) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        await assertOwned();
        active -= 1;
        return "done";
      });

    await expect(Promise.all([operation(), operation(), operation()])).resolves.toEqual([
      "done",
      "done",
      "done",
    ]);
    expect(maximumActive).toBe(1);
  });
});
