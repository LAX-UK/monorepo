import { createDb } from "@auction/db";
import { oauthApplication, oauthConsent, user } from "@auction/db/schema";
import { createDrizzleConsentStore } from "@auction/identity-db";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("drizzle consent store", () => {
  const db = DATABASE_URL ? createDb(DATABASE_URL) : undefined;
  const store = db ? createDrizzleConsentStore(db) : undefined;
  const userId = "90000000-0000-4000-8000-000000000099";
  const clientId = "consent-store-integration-client";
  const now = new Date();

  afterAll(async () => {
    if (!db) return;
    await db.delete(oauthConsent).where(eq(oauthConsent.clientId, clientId));
    await db.delete(oauthApplication).where(eq(oauthApplication.clientId, clientId));
    await db.delete(user).where(eq(user.id, userId));
  });

  async function seedFixtures() {
    if (!db) return;
    await db
      .insert(user)
      .values({
        id: userId,
        name: "Consent Store Test",
        email: "consent-store-test@lax.bid",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await db
      .insert(oauthApplication)
      .values({
        id: "consent-store-integration-app",
        name: "Consent Store Test",
        clientId,
        redirectUrls: "http://localhost:3010/auth/callback",
        type: "web",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  it("merges scopes atomically under concurrent upserts", async () => {
    if (!db || !store) return;
    await seedFixtures();
    await db.delete(oauthConsent).where(eq(oauthConsent.clientId, clientId));

    const base = {
      clientId,
      userId,
      consentGiven: true,
      createdAt: now,
      updatedAt: now,
    };

    await Promise.all([
      store.upsert({
        ...base,
        id: "consent-a",
        scopes: "openid profile email",
      }),
      store.upsert({
        ...base,
        id: "consent-b",
        scopes: "openid offline_access",
      }),
    ]);

    const rows = await db.select().from(oauthConsent).where(eq(oauthConsent.clientId, clientId));
    expect(rows).toHaveLength(1);
    const scopes = rows[0]?.scopes.split(" ").sort();
    expect(scopes).toEqual(["email", "offline_access", "openid", "profile"]);
  });
});
