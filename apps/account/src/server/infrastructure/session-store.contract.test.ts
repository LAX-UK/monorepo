import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionStore } from "../ports/session-store";
import { createMemorySessionStore } from "./memory-session-store";
import { createRedisSessionStore } from "./redis-session-store";

const sampleRecord = {
  subject: "staff-subject",
  sid: "session-sid",
  idToken: "id.jwt.token",
  accessToken: "access",
  refreshToken: "refresh",
  accessTokenExpiresAtMs: Date.now() + 3_600_000,
  authTime: Math.floor(Date.now() / 1000),
  acr: "silver",
};

function defineContract(name: string, makeStore: () => SessionStore, skip = false) {
  describe.skipIf(skip)(`SessionStore contract (${name})`, () => {
    it("persists, invalidates by sid, and dedupes logout jti", async () => {
      const store = makeStore();
      await store.save("sess-1", sampleRecord, 3600);
      expect(await store.get("sess-1")).toMatchObject({ subject: "staff-subject" });
      await store.invalidateBySidOrSubject({ sid: "session-sid" });
      expect(await store.get("sess-1")).toBeNull();
      expect(await store.claimBackchannelLogoutJti("jti-1", 60)).toBe(true);
      expect(await store.claimBackchannelLogoutJti("jti-1", 60)).toBe(false);
      await store.releaseBackchannelLogoutJti("jti-1");
      expect(await store.claimBackchannelLogoutJti("jti-1", 60)).toBe(true);
    });

    it("scopes a sid logout to that session and a subject logout to every session", async () => {
      const store = makeStore();
      await store.save("browser-a", sampleRecord, 3600);
      await store.save("browser-b", { ...sampleRecord, sid: "other-sid" }, 3600);

      await store.invalidateBySidOrSubject({ sid: "session-sid", sub: "staff-subject" });
      expect(await store.get("browser-a")).toBeNull();
      expect(await store.get("browser-b")).not.toBeNull();

      await store.save("browser-a", sampleRecord, 3600);
      await store.invalidateBySidOrSubject({ sub: "staff-subject" });
      expect(await store.get("browser-a")).toBeNull();
      expect(await store.get("browser-b")).toBeNull();
    });

    it("claims a pending sign-in once, and a sign-out ends it at any stage", async () => {
      const store = makeStore();
      expect(await store.claimPendingLogin("state-a", 600)).toBe(true);
      expect(await store.claimPendingLogin("state-a", 600)).toBe(false);

      await store.revokePendingLogin("state-b", 600);
      expect(await store.claimPendingLogin("state-b", 600)).toBe(false);

      expect(await store.claimPendingLogin("state-c", 600)).toBe(true);
      await store.revokePendingLogin("state-c", 600);
      expect(await store.settlePendingLogin("state-c", "sess-c")).toBe(false);

      expect(await store.claimPendingLogin("state-d", 600)).toBe(true);
      await store.save("sess-d", sampleRecord, 3600);
      expect(await store.settlePendingLogin("state-d", "sess-d")).toBe(true);
      await store.revokePendingLogin("state-d", 600);
      expect(await store.get("sess-d")).toBeNull();
    });

    it("tells a sign-out from a callback that was already taken", async () => {
      const store = makeStore();
      expect(await store.isPendingLoginRevoked("state-e")).toBe(false);
      expect(await store.claimPendingLogin("state-e", 600)).toBe(true);
      expect(await store.isPendingLoginRevoked("state-e")).toBe(false);
      await store.revokePendingLogin("state-e", 600);
      expect(await store.isPendingLoginRevoked("state-e")).toBe(true);
    });
  });
}

defineContract("memory", createMemorySessionStore);

const hasRedis = spawnSync("redis-server", ["--version"]).status === 0;
let redisProc: ChildProcess | undefined;
let redisUrl = "";
const clients: SessionStore[] = [];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

// Runs the same contract against a real Redis when redis-server is installed; skipped otherwise.
beforeAll(async () => {
  if (!hasRedis) return;
  const port = await freePort();
  redisProc = spawn("redis-server", ["--port", String(port), "--bind", "127.0.0.1", "--save", ""], {
    stdio: "ignore",
  });
  redisUrl = `redis://127.0.0.1:${port}`;
  const probe = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
  probe.on("error", () => {});
  for (let i = 0; i < 50; i++) {
    try {
      await probe.connect();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  probe.disconnect();
}, 20_000);

afterAll(() => {
  redisProc?.kill();
});

let prefixCounter = 0;
defineContract(
  "redis",
  () => {
    const store = createRedisSessionStore({
      redisUrl,
      encryptionKey: "contract-test-key",
      keyPrefix: `contract-${process.pid}-${prefixCounter++}:`,
    });
    clients.push(store);
    return store;
  },
  !hasRedis,
);
