import type { IdentityEventPublisher } from "@auction/auth";
import { createDb } from "@auction/db";
import type { IdentityDatabase } from "@auction/identity-db";
import {
  account,
  identityLifecycleOutbox,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  session,
  user,
} from "@auction/identity-db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type IdentityLifecycleConflictError,
  IdentityLifecycleService,
} from "../services/identity-lifecycle.service.js";
import { createDrizzleIdentityEventPublisher } from "./drizzle-identity-event-publisher.js";
import { DrizzleIdentityLifecycleRepository } from "./drizzle-identity-lifecycle-repository.js";

const DATABASE_URL = process.env.DATABASE_URL;
const NOW = new Date("2026-08-19T00:00:00.000Z");

describe.skipIf(!DATABASE_URL)("drizzle identity lifecycle repository", () => {
  const db = DATABASE_URL ? createDb(DATABASE_URL) : undefined;
  const repository = db
    ? new DrizzleIdentityLifecycleRepository(db as unknown as IdentityDatabase)
    : undefined;
  const canonicalSubjectId = "90000000-0000-4000-8000-000000000095";
  const retiredSubjectId = "90000000-0000-4000-8000-000000000096";
  const subjectIds = [canonicalSubjectId, retiredSubjectId];
  const clientId = "identity-lifecycle-test-client";
  const applicationId = "identity-lifecycle-test-app";
  const tokenId = "identity-lifecycle-test-token";
  const sessionId = "identity-lifecycle-test-session";
  const consentId = "identity-lifecycle-test-consent";
  const accountIds = [
    "identity-lifecycle-canonical-credential",
    "identity-lifecycle-canonical-google",
    "identity-lifecycle-retired-credential",
    "identity-lifecycle-retired-google",
  ] as const;

  function createService(options?: {
    publisher?: IdentityEventPublisher;
    logout?: { revokeSubject(subjectId: string): Promise<number> };
  }) {
    if (!db || !repository) return undefined;
    return new IdentityLifecycleService(
      repository,
      options?.publisher ?? createDrizzleIdentityEventPublisher(db),
      options?.logout,
      () => NOW,
    );
  }

  async function clearSubjectState(): Promise<void> {
    if (!db) return;
    await db
      .delete(identityLifecycleOutbox)
      .where(inArray(identityLifecycleOutbox.aggregateId, subjectIds));
    await db.delete(oauthConsent).where(eq(oauthConsent.id, consentId));
    await db.delete(oauthAccessToken).where(eq(oauthAccessToken.id, tokenId));
    await db.delete(session).where(eq(session.id, sessionId));
    await db.delete(account).where(inArray(account.id, [...accountIds]));
    await db.delete(user).where(inArray(user.id, subjectIds));
  }

  async function insertAuthState(subjectId: string): Promise<void> {
    if (!db) return;
    await db.insert(session).values({
      id: sessionId,
      token: "identity-lifecycle-session-token",
      userId: subjectId,
      expiresAt: new Date(NOW.getTime() + 120_000),
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db.insert(oauthAccessToken).values({
      id: tokenId,
      accessToken: "identity-lifecycle-access-token",
      refreshToken: "identity-lifecycle-refresh-token",
      accessTokenExpiresAt: new Date(NOW.getTime() + 60_000),
      refreshTokenExpiresAt: new Date(NOW.getTime() + 120_000),
      clientId,
      userId: subjectId,
      scopes: "openid",
      createdAt: NOW,
      updatedAt: NOW,
    });
  }

  beforeEach(async () => {
    if (!db) return;
    await clearSubjectState();
    await db.insert(user).values([
      {
        id: canonicalSubjectId,
        name: "Canonical Lifecycle Subject",
        email: "identity-lifecycle-canonical@lax.bid",
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: retiredSubjectId,
        name: "Retired Lifecycle Subject",
        email: "identity-lifecycle-retired@lax.bid",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
    await db
      .insert(oauthApplication)
      .values({
        id: applicationId,
        name: "Identity Lifecycle Test",
        clientId,
        redirectUrls: "http://localhost:3010/auth/callback",
        type: "web",
        createdAt: NOW,
        updatedAt: NOW,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    if (!db) return;
    await clearSubjectState();
    await db.delete(oauthApplication).where(eq(oauthApplication.id, applicationId));
  });

  it("atomically disables auth state, publishes an event, and enables the subject again", async () => {
    if (!db) return;
    const revokeSubject = vi.fn(async () => 0);
    const service = createService({ logout: { revokeSubject } });
    if (!service) return;
    await insertAuthState(retiredSubjectId);

    await service.disable(retiredSubjectId, "security_review");

    const disabled = await db.query.user.findFirst({
      where: eq(user.id, retiredSubjectId),
      columns: { identityDisabledAt: true, identityDisabledReason: true },
    });
    expect(disabled).toMatchObject({
      identityDisabledAt: NOW,
      identityDisabledReason: "security_review",
    });
    await expect(
      db.select({ id: session.id }).from(session).where(eq(session.id, sessionId)),
    ).resolves.toEqual([]);
    await expect(
      db
        .select({ id: oauthAccessToken.id })
        .from(oauthAccessToken)
        .where(eq(oauthAccessToken.id, tokenId)),
    ).resolves.toEqual([]);
    expect(revokeSubject).toHaveBeenCalledWith(retiredSubjectId);

    await service.enable(retiredSubjectId);
    const enabled = await db.query.user.findFirst({
      where: eq(user.id, retiredSubjectId),
      columns: { identityDisabledAt: true, identityDisabledReason: true },
    });
    expect(enabled).toEqual({ identityDisabledAt: null, identityDisabledReason: null });
    const events = await db
      .select({ eventType: identityLifecycleOutbox.eventType })
      .from(identityLifecycleOutbox)
      .where(eq(identityLifecycleOutbox.aggregateId, retiredSubjectId));
    expect(events.map((event) => event.eventType)).toEqual([
      "user.identity_disabled",
      "user.identity_enabled",
    ]);
  });

  it("rolls back lifecycle writes when in-transaction event publication fails", async () => {
    if (!db) return;
    const publisher: IdentityEventPublisher = {
      publish: vi.fn(async () => {
        throw new Error("outbox unavailable");
      }),
    };
    const service = createService({ publisher });
    if (!service) return;
    await insertAuthState(retiredSubjectId);

    await expect(service.disable(retiredSubjectId)).rejects.toThrow("outbox unavailable");

    const subject = await db.query.user.findFirst({
      where: eq(user.id, retiredSubjectId),
      columns: { identityDisabledAt: true },
    });
    expect(subject?.identityDisabledAt).toBeNull();
    await expect(
      db.select({ id: session.id }).from(session).where(eq(session.id, sessionId)),
    ).resolves.toEqual([{ id: sessionId }]);
    await expect(
      db
        .select({ id: oauthAccessToken.id })
        .from(oauthAccessToken)
        .where(eq(oauthAccessToken.id, tokenId)),
    ).resolves.toEqual([{ id: tokenId }]);
  });

  it("merges credentials and consent while retiring auth state and publishing the alias", async () => {
    if (!db) return;
    const revokeSubject = vi.fn(async () => 0);
    const service = createService({ logout: { revokeSubject } });
    if (!service) return;
    await db.insert(account).values([
      {
        id: accountIds[0],
        accountId: "shared-credential",
        providerId: "credential",
        userId: canonicalSubjectId,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: accountIds[2],
        accountId: "shared-credential",
        providerId: "credential",
        userId: retiredSubjectId,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: accountIds[3],
        accountId: "retired-google",
        providerId: "google",
        userId: retiredSubjectId,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
    await db.insert(oauthConsent).values({
      id: consentId,
      clientId,
      userId: retiredSubjectId,
      scopes: "openid",
      consentGiven: true,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await insertAuthState(retiredSubjectId);

    await service.merge(retiredSubjectId, canonicalSubjectId);

    const retired = await db.query.user.findFirst({
      where: eq(user.id, retiredSubjectId),
      columns: {
        identityDisabledAt: true,
        identityDisabledReason: true,
        mergedIntoSubjectId: true,
      },
    });
    expect(retired).toEqual({
      identityDisabledAt: NOW,
      identityDisabledReason: "merged",
      mergedIntoSubjectId: canonicalSubjectId,
    });
    const storedAccounts = await db
      .select({ id: account.id, userId: account.userId })
      .from(account)
      .where(inArray(account.id, [...accountIds]));
    expect(storedAccounts).toEqual(
      expect.arrayContaining([
        { id: accountIds[0], userId: canonicalSubjectId },
        { id: accountIds[3], userId: canonicalSubjectId },
      ]),
    );
    expect(storedAccounts.some((stored) => stored.id === accountIds[2])).toBe(false);
    const [consent] = await db
      .select({ userId: oauthConsent.userId })
      .from(oauthConsent)
      .where(eq(oauthConsent.id, consentId));
    expect(consent?.userId).toBe(canonicalSubjectId);
    await expect(
      db.select({ id: session.id }).from(session).where(eq(session.id, sessionId)),
    ).resolves.toEqual([]);
    await expect(
      db
        .select({ id: oauthAccessToken.id })
        .from(oauthAccessToken)
        .where(eq(oauthAccessToken.id, tokenId)),
    ).resolves.toEqual([]);
    const [event] = await db
      .select({
        eventType: identityLifecycleOutbox.eventType,
        payload: identityLifecycleOutbox.payload,
      })
      .from(identityLifecycleOutbox)
      .where(
        and(
          eq(identityLifecycleOutbox.aggregateId, canonicalSubjectId),
          eq(identityLifecycleOutbox.eventType, "user.identity_merged"),
        ),
      );
    expect(event).toMatchObject({
      eventType: "user.identity_merged",
      payload: {
        subjectId: canonicalSubjectId,
        retiredSubjectId,
      },
    });
    expect(revokeSubject).toHaveBeenCalledWith(retiredSubjectId);
  });

  it("rolls back and reports an invalid merge for conflicting provider accounts", async () => {
    if (!db) return;
    const revokeSubject = vi.fn(async () => 0);
    const service = createService({ logout: { revokeSubject } });
    if (!service) return;
    await db.insert(account).values([
      {
        id: accountIds[1],
        accountId: "canonical-google",
        providerId: "google",
        userId: canonicalSubjectId,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: accountIds[3],
        accountId: "retired-google",
        providerId: "google",
        userId: retiredSubjectId,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);

    await expect(service.merge(retiredSubjectId, canonicalSubjectId)).rejects.toMatchObject({
      code: "invalid_merge",
    } satisfies Partial<IdentityLifecycleConflictError>);

    const retired = await db.query.user.findFirst({
      where: eq(user.id, retiredSubjectId),
      columns: { identityDisabledAt: true, mergedIntoSubjectId: true },
    });
    expect(retired).toEqual({ identityDisabledAt: null, mergedIntoSubjectId: null });
    const [retiredAccount] = await db
      .select({ userId: account.userId })
      .from(account)
      .where(eq(account.id, accountIds[3]));
    expect(retiredAccount?.userId).toBe(retiredSubjectId);
    expect(revokeSubject).not.toHaveBeenCalled();
  });

  it("distinguishes missing subjects from invalid transitions on merged subjects", async () => {
    if (!db) return;
    const service = createService();
    if (!service) return;
    await expect(service.disable("missing-subject")).rejects.toMatchObject({
      code: "subject_not_found",
    } satisfies Partial<IdentityLifecycleConflictError>);
    await db
      .update(user)
      .set({
        identityDisabledAt: NOW,
        identityDisabledReason: "merged",
        mergedIntoSubjectId: canonicalSubjectId,
        updatedAt: NOW,
      })
      .where(eq(user.id, retiredSubjectId));

    await expect(service.enable(retiredSubjectId)).rejects.toMatchObject({
      code: "invalid_merge",
    } satisfies Partial<IdentityLifecycleConflictError>);
  });

  it("treats an already completed merge as an event-free no-op", async () => {
    if (!db) return;
    const revokeSubject = vi.fn(async () => 0);
    const service = createService({ logout: { revokeSubject } });
    if (!service) return;
    await db
      .update(user)
      .set({
        identityDisabledAt: NOW,
        identityDisabledReason: "merged",
        mergedIntoSubjectId: canonicalSubjectId,
        updatedAt: NOW,
      })
      .where(eq(user.id, retiredSubjectId));

    await service.merge(retiredSubjectId, canonicalSubjectId);

    const events = await db
      .select({ id: identityLifecycleOutbox.id })
      .from(identityLifecycleOutbox)
      .where(eq(identityLifecycleOutbox.aggregateId, canonicalSubjectId));
    expect(events).toEqual([]);
    expect(revokeSubject).not.toHaveBeenCalled();
  });
});
