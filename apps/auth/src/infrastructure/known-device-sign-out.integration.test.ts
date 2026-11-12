import { randomUUID } from "node:crypto";
import type { EmailEnqueueInput } from "@auction/auth";
import { createIdentityDb } from "@auction/identity-db";
import { authKnownDevice, session, user } from "@auction/identity-db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPasswordResetSessionRevoker } from "../container/create-auth-issuer.js";
import type { IdentityOperationTransaction } from "../services/identity-operations.ports.js";
import { fingerprintMarker } from "../services/known-device.js";
import { SecurityNoticeService } from "../services/security-notice.service.js";
import { DrizzleIdentitySessionRepository } from "./drizzle-identity-session-repository.js";
import { DrizzleKnownDeviceStore } from "./drizzle-known-device.store.js";

const DATABASE_URL = process.env.DATABASE_URL;
const run = randomUUID().slice(0, 8);
const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36";
const FIREFOX_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0";
const start = new Date("2026-11-12T09:00:00.000Z");
const minutes = (n: number) => new Date(start.getTime() + n * 60_000);

/**
 * S1: a browser the person signs out (from the devices list, by a reset, or by itself) must not
 * keep vouching for its next sign-in through its device marker.
 */
describe.skipIf(!DATABASE_URL)("known-device marker after sign-out (Postgres)", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const users: string[] = [];

  async function person(label: string) {
    if (!db) throw new Error("no database");
    const id = `s1-${run}-${label}`;
    users.push(id);
    await db.insert(user).values({
      id,
      name: id,
      email: `${id}@example.test`,
      createdAt: start,
      updatedAt: start,
    });
    const sent: EmailEnqueueInput[] = [];
    const notices = new SecurityNoticeService(
      {
        subjects: {
          findById: async () => ({ id, email: `${id}@example.test`, name: id }),
          // No saved zone: notices are told on the London clock.
          readTimeZone: async () => null,
        } as never,
        email: {
          enqueue: async (input) => {
            sent.push(input);
            return { outboxId: `o-${sent.length}` };
          },
        },
        devices: new DrizzleKnownDeviceStore(db),
        secureAccountUrl: "https://account.example.test/account/security",
        cancelDeletionUrl: "https://account.example.test/account/security/delete",
        dataExportUrl: "https://account.example.test/account/privacy/download",
        log: { warn: () => undefined, error: () => undefined },
      },
      () => minutes(30),
    );
    const signIn = async (at: Date, userAgent: string, deviceHash: string, sessionId: string) => {
      await db.insert(session).values({
        id: sessionId,
        token: `tok-${sessionId}`,
        userId: id,
        userAgent,
        country: "GB",
        deviceHash,
        createdAt: at,
        updatedAt: at,
        expiresAt: new Date(at.getTime() + 86_400_000),
      });
      await notices.notify({
        kind: "sign_in",
        userId: id,
        at,
        userAgent,
        region: "GB",
        deviceHash,
      });
    };
    const newDeviceEmails = () =>
      sent.filter((mail) => mail.template === "new-device-login").length;
    // The person's own laptop first, so a later browser is "another device".
    await signIn(minutes(0), CHROME_MAC, `${id}-laptop-hash`, `${id}-laptop`);
    return { id, signIn, newDeviceEmails };
  }

  const markerRows = async (userId: string, deviceHash: string) =>
    db
      ?.select({ fingerprint: authKnownDevice.fingerprint })
      .from(authKnownDevice)
      .where(eq(authKnownDevice.userId, userId))
      .then((rows) =>
        rows.filter((row) => row.fingerprint === fingerprintMarker({ userId, deviceHash })),
      );

  beforeAll(() => {
    expect(db).toBeDefined();
  });

  afterAll(async () => {
    if (!db) return;
    for (const id of users) await db.delete(user).where(eq(user.id, id));
  });

  it("emails again when a browser signed out from the devices list signs back in", async () => {
    if (!db) return;
    const ann = await person("list");
    const x = `${ann.id}-x-hash`;
    await ann.signIn(minutes(1), FIREFOX_WIN, x, `${ann.id}-x1`);
    expect(ann.newDeviceEmails()).toBe(1);
    // Signing in again from X while it is known: quiet.
    await ann.signIn(minutes(2), FIREFOX_WIN, x, `${ann.id}-x2`);
    expect(ann.newDeviceEmails()).toBe(1);

    const sessions = new DrizzleIdentitySessionRepository(db, () => minutes(3));
    await db.transaction(async (tx) => {
      await sessions.deleteSession(
        tx as unknown as IdentityOperationTransaction,
        ann.id,
        `${ann.id}-x2`,
      );
    });
    expect(await markerRows(ann.id, x)).toEqual([]);

    // The attacker's browser X comes back: its label and country were seen minutes ago, but it
    // was signed out, so it is new again.
    await ann.signIn(minutes(4), FIREFOX_WIN, x, `${ann.id}-x3`);
    expect(ann.newDeviceEmails()).toBe(2);
    // Reported once: the next sign-in from X is quiet again.
    await ann.signIn(minutes(5), FIREFOX_WIN, x, `${ann.id}-x4`);
    expect(ann.newDeviceEmails()).toBe(2);
  });

  it("does the same for 'sign out everywhere else' and keeps the current browser known", async () => {
    if (!db) return;
    const ben = await person("others");
    const x = `${ben.id}-x-hash`;
    await ben.signIn(minutes(1), FIREFOX_WIN, x, `${ben.id}-x1`);
    expect(ben.newDeviceEmails()).toBe(1);

    const sessions = new DrizzleIdentitySessionRepository(db, () => minutes(3));
    await db.transaction(async (tx) => {
      await sessions.deleteOtherSessions(
        tx as unknown as IdentityOperationTransaction,
        ben.id,
        `${ben.id}-laptop`,
      );
    });
    expect(await markerRows(ben.id, x)).toEqual([]);
    expect(await markerRows(ben.id, `${ben.id}-laptop-hash`)).toHaveLength(1);

    await ben.signIn(minutes(4), FIREFOX_WIN, x, `${ben.id}-x2`);
    expect(ben.newDeviceEmails()).toBe(2);
    // The laptop that stayed signed in is still known.
    await ben.signIn(minutes(6), CHROME_MAC, `${ben.id}-laptop-hash`, `${ben.id}-laptop-2`);
    expect(ben.newDeviceEmails()).toBe(2);
  });

  it("does the same after a password reset ends every sign-in", async () => {
    if (!db) return;
    const cy = await person("reset");
    const x = `${cy.id}-x-hash`;
    await cy.signIn(minutes(1), FIREFOX_WIN, x, `${cy.id}-x1`);
    const revokeAll = createPasswordResetSessionRevoker({
      db,
      logout: { revokeSubject: async () => 0 },
      identityEventPublisher: { publish: async () => undefined } as never,
    });
    await revokeAll(cy.id);
    expect(await markerRows(cy.id, x)).toEqual([]);

    await cy.signIn(minutes(4), FIREFOX_WIN, x, `${cy.id}-x2`);
    expect(cy.newDeviceEmails()).toBe(2);
  });

  it("forgets the marker of a browser that signs itself out, leaving the label rule to decide", async () => {
    if (!db) return;
    const dee = await person("self");
    const x = `${dee.id}-x-hash`;
    await dee.signIn(minutes(1), FIREFOX_WIN, x, `${dee.id}-x1`);
    expect(await markerRows(dee.id, x)).toHaveLength(1);

    await new DrizzleKnownDeviceStore(db).forgetBrowser({ userId: dee.id, deviceHash: x });
    expect(await markerRows(dee.id, x)).toEqual([]);
    // Not flagged as owing a notice: the person signed themselves out, so a sign-in soon after
    // from the same label and country is not news.
    await dee.signIn(minutes(4), FIREFOX_WIN, x, `${dee.id}-x2`);
    expect(dee.newDeviceEmails()).toBe(1);
  });
});
