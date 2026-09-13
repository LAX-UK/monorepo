import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, createDb } from "../client.js";
import { user } from "../schema/auth.js";
import { bidUserProfile } from "../schema/bid-user-profile.js";
import { readIdentityProfileDrift } from "./reconcile-identity-profile-drift.js";

const DATABASE_URL = process.env.DATABASE_URL;
const SUBJECT_ID = "identity-profile-drift-regression";
const NOW = new Date("2026-09-13T06:00:00.000Z");

describe.skipIf(!DATABASE_URL)("identity profile drift reconciliation", () => {
  const db = DATABASE_URL ? createDb(DATABASE_URL) : undefined;

  async function clearFixture(): Promise<void> {
    if (!db) return;
    await db.delete(bidUserProfile).where(eq(bidUserProfile.userId, SUBJECT_ID));
    await db.delete(user).where(eq(user.id, SUBJECT_ID));
  }

  beforeEach(clearFixture);
  afterAll(async () => {
    await clearFixture();
    if (db) await closeDb(db);
  });

  it("reads the canonical public user table on a migrated database", async () => {
    if (!db) return;
    const baseline = await readIdentityProfileDrift(db);
    await db.insert(user).values({
      id: SUBJECT_ID,
      name: "Identity profile drift regression",
      email: "identity-profile-drift-regression@example.test",
      createdAt: NOW,
      updatedAt: NOW,
    });

    await expect(readIdentityProfileDrift(db)).resolves.toEqual({
      missing: baseline.missing + 1,
      orphan: baseline.orphan,
    });

    await db.insert(bidUserProfile).values({
      userId: SUBJECT_ID,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await expect(readIdentityProfileDrift(db)).resolves.toEqual(baseline);
  });
});
