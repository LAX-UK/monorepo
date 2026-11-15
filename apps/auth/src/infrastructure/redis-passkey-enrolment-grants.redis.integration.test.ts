import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { passkeyGrantKey } from "../services/passkey-enrolment-grant.js";
import { GIVE_BACK_SCRIPT, RedisPasskeyEnrolmentGrants } from "./redis-passkey-enrolment-grants.js";

/** The scripts against a real redis-server, started here on a free port; skipped when there is none. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let server: ChildProcess | undefined;
let redis: Redis | undefined;
let dir: string | undefined;
let available = false;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "grants-redis-"));
  try {
    const port = await freePort();
    server = spawn(
      "redis-server",
      ["--port", String(port), "--bind", "127.0.0.1", "--save", "", "--dir", dir],
      { stdio: "ignore" },
    );
    server.on("error", () => {
      server = undefined;
    });
    const client = new Redis({
      host: "127.0.0.1",
      port,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    client.on("error", () => undefined);
    for (let i = 0; i < 40 && !available && server; i += 1) {
      try {
        await client.connect();
        await client.ping();
        available = true;
        redis = client;
      } catch {
        await sleep(100);
      }
    }
    if (!available) client.disconnect();
  } catch {
    available = false;
  }
}, 15_000);

afterAll(async () => {
  redis?.disconnect();
  server?.kill();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const live = (fn: (r: Redis) => Promise<void>) => async (ctx: { skip: () => void }) => {
  if (!available || !redis) return ctx.skip();
  await redis.flushall();
  await fn(redis);
};

describe("the grant scripts against a real Redis", () => {
  it(
    "spends once and reports an end inside the five minutes",
    live(async (r) => {
      const grants = new RedisPasskeyEnrolmentGrants(r);
      await grants.grant("sid-1", "u1");
      const spent = await grants.spend("sid-1", "u1");
      const now = Date.now();
      expect(spent?.expiresAtMs).toBeGreaterThan(now);
      expect(spent?.expiresAtMs).toBeLessThanOrEqual(now + 300_000 + 5_000);
      expect(await grants.spend("sid-1", "u1")).toBeNull();
      expect(await grants.holds("sid-1", "u1")).toBe(false);
    }),
  );

  it(
    "returns null for a missing key and for the wrong subject (which still burns the grant)",
    live(async (r) => {
      const grants = new RedisPasskeyEnrolmentGrants(r);
      expect(await grants.spend("sid-1", "u1")).toBeNull();
      await grants.grant("sid-1", "u1");
      expect(await grants.spend("sid-1", "u2")).toBeNull();
      expect(await grants.holds("sid-1", "u1")).toBe(false);
    }),
  );

  it(
    "gives nothing back for a key that had no expiry (PTTL -1)",
    live(async (r) => {
      const grants = new RedisPasskeyEnrolmentGrants(r);
      await r.set(passkeyGrantKey("sid-1"), "u1");
      expect(await r.pttl(passkeyGrantKey("sid-1"))).toBe(-1);
      expect(await grants.spend("sid-1", "u1")).toEqual({ expiresAtMs: 0 });
      await grants.giveBack("sid-1", "u1", 0);
      expect(await r.exists(passkeyGrantKey("sid-1"))).toBe(0);
    }),
  );

  it(
    "gives back until the original end, however long the attempt took",
    live(async (r) => {
      const grants = new RedisPasskeyEnrolmentGrants(r);
      await grants.grant("sid-1", "u1");
      const spent = await grants.spend("sid-1", "u1");
      await sleep(400); // the attempt
      await grants.giveBack("sid-1", "u1", spent?.expiresAtMs ?? 0);
      const pttl = await r.pttl(passkeyGrantKey("sid-1"));
      const before = (spent?.expiresAtMs ?? 0) - Date.now();
      expect(pttl).toBeGreaterThan(0);
      expect(pttl).toBeLessThanOrEqual(300_000 - 400 + 50);
      expect(pttl).toBeLessThanOrEqual(before + 50);
    }),
  );

  it(
    "gives nothing back when the end passed during the attempt",
    live(async (r) => {
      const grants = new RedisPasskeyEnrolmentGrants(r);
      await grants.grant("sid-1", "u1");
      const spent = await grants.spend("sid-1", "u1");
      // The grant's end falls between spend and give-back.
      await grants.giveBack("sid-1", "u1", Date.now() + 200);
      await sleep(300);
      await grants.giveBack("sid-1", "u1", Date.now() - 1);
      expect(spent).not.toBeNull();
      expect(await grants.holds("sid-1", "u1")).toBe(false);
    }),
  );

  it(
    "does not give back when under the floor, cap what comes back, and never replaces a held grant",
    live(async (r) => {
      const grants = new RedisPasskeyEnrolmentGrants(r);
      await grants.giveBack("sid-1", "u1", Date.now() + 500);
      expect(await r.exists(passkeyGrantKey("sid-1"))).toBe(0);
      await grants.giveBack("sid-1", "u1", Date.now() + 3_600_000);
      expect(await r.pttl(passkeyGrantKey("sid-1"))).toBeLessThanOrEqual(300_000);
      await r.set(passkeyGrantKey("sid-2"), "held", "PX", 10_000);
      await grants.giveBack("sid-2", "u1", Date.now() + 200_000);
      expect(await r.get(passkeyGrantKey("sid-2"))).toBe("held");
      expect(await r.pttl(passkeyGrantKey("sid-2"))).toBeLessThanOrEqual(10_000);
    }),
  );

  it(
    "give-back script reports 1 when put back and 0 when not",
    live(async (r) => {
      const args = [passkeyGrantKey("sid-9"), "u1", String(Date.now() + 60_000), "300000", "1000"];
      expect(await r.eval(GIVE_BACK_SCRIPT, 1, ...args)).toBe(1);
      expect(await r.eval(GIVE_BACK_SCRIPT, 1, ...args)).toBe(0);
    }),
  );
});
