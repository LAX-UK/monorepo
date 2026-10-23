import { createIdentityDb } from "@auction/identity-db";
import { authKnownDevice, authSecurityEffectOutbox, user } from "@auction/identity-db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DurableSecurityEffects } from "../services/durable-security-effects.js";
import { DrizzleKnownDeviceStore } from "./drizzle-known-device.store.js";
import { DrizzleSecurityEffectOutboxRepository } from "./drizzle-security-effect-outbox.repository.js";

const DATABASE_URL = process.env.DATABASE_URL;
const USER = "90000000-0000-4000-8000-000000000071";

describe.skipIf(!DATABASE_URL)("security notices against Postgres", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const now = new Date("2026-10-23T12:00:00.000Z");

  beforeAll(async () => {
    if (!db) return;
    await db
      .insert(user)
      .values({
        id: USER,
        name: "Security Notices Test",
        email: "security-notices-test@lax.bid",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(authSecurityEffectOutbox).where(eq(authSecurityEffectOutbox.userId, USER));
    await db.delete(user).where(eq(user.id, USER));
  });

  describe("known devices", () => {
    it("reports what was known before each sign-in and remembers the device", async () => {
      if (!db) return;
      const store = new DrizzleKnownDeviceStore(db);
      const first = await store.touch({ userId: USER, fingerprint: "device-a", at: now });
      expect(first).toEqual({ previousLastSeenAt: null, hadOtherDevices: false });

      const later = new Date(now.getTime() + 60_000);
      expect(await store.touch({ userId: USER, fingerprint: "device-a", at: later })).toEqual({
        previousLastSeenAt: now,
        hadOtherDevices: false,
      });
      expect(await store.touch({ userId: USER, fingerprint: "device-b", at: later })).toEqual({
        previousLastSeenAt: null,
        hadOtherDevices: true,
      });
    });

    it("counts notices per person inside the window", async () => {
      if (!db) return;
      const store = new DrizzleKnownDeviceStore(db);
      const since = new Date(now.getTime() - 1_000);
      expect(await store.countNoticesSince(USER, since)).toBe(0);
      await store.markNotified({ userId: USER, fingerprint: "device-b", at: now });
      expect(await store.countNoticesSince(USER, since)).toBe(1);
      expect(await store.countNoticesSince(USER, new Date(now.getTime() + 1_000))).toBe(0);
    });

    it("stores a hash only: no user agent and no address columns exist", async () => {
      if (!db) return;
      const columns = Object.keys(authKnownDevice);
      expect(columns).not.toEqual(expect.arrayContaining(["userAgent"]));
      expect(columns).not.toEqual(expect.arrayContaining(["ipAddress"]));
    });
  });

  describe("durable security effects", () => {
    it("survives a restart: a new instance finds and completes the stored job", async () => {
      if (!db) return;
      const repository = new DrizzleSecurityEffectOutboxRepository(db);
      const calls: string[] = [];
      const ports = (fail: boolean) =>
        ({
          operations: { removeOtherSessions: async () => [] },
          logout: {
            revokeSubject: async () => {
              calls.push("revokeSubject");
              if (fail) throw new Error("redis down");
              return 1;
            },
          },
          events: { publish: async () => undefined },
        }) as never;
      const log = { warn: () => undefined, error: () => undefined };
      let clock = now;

      await new DurableSecurityEffects(repository, ports(true), log, () => clock).settle("/x", {
        kind: "revoke_subject_tokens",
        userId: USER,
      });
      const [stored] = await db
        .select()
        .from(authSecurityEffectOutbox)
        .where(eq(authSecurityEffectOutbox.userId, USER));
      expect(stored).toMatchObject({
        kind: "revoke_subject_tokens",
        status: "pending",
        attemptCount: 1,
        lastError: "redis down",
      });

      clock = new Date(now.getTime() + 2_000);
      const restarted = new DurableSecurityEffects(repository, ports(false), log, () => clock);
      await expect(restarted.drain()).resolves.toBe(1);

      expect(calls).toEqual(["revokeSubject", "revokeSubject"]);
      expect(
        await db
          .select()
          .from(authSecurityEffectOutbox)
          .where(eq(authSecurityEffectOutbox.userId, USER)),
      ).toEqual([]);
    });

    it("lets two workers drain without taking the same job", async () => {
      if (!db) return;
      const repository = new DrizzleSecurityEffectOutboxRepository(db);
      for (let index = 0; index < 4; index += 1) {
        await repository.enqueue({
          job: { kind: "revoke_subject_tokens", userId: USER },
          error: "seed",
          nextAttemptAt: now,
        });
      }
      const claim = () =>
        repository.claimDue({ now, staleBefore: new Date(now.getTime() - 60_000), batchSize: 3 });
      const [a, b] = await Promise.all([claim(), claim()]);
      const ids = [...a, ...b].map((row) => row.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(4);
    });
  });
});
