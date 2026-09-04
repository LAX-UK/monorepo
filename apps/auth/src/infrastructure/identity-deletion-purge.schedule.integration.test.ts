import { createIdentityDb } from "@auction/identity-db";
import { user } from "@auction/identity-db/schema";
import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { purgeDeletedSubjectsBatch } from "./identity-deletion-purge.schedule.js";

const DATABASE_URL = process.env.DATABASE_URL;
const now = new Date("2026-08-19T00:00:00Z");
const eligibleId = "identity-deletion-purge-eligible";
const coolingOffId = "identity-deletion-purge-cooling-off";
const subjectIds = [eligibleId, coolingOffId] as const;

describe.skipIf(!DATABASE_URL)("identity deletion purge schedule", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;

  afterAll(async () => {
    if (!db) return;
    await db.delete(user).where(inArray(user.id, [...subjectIds]));
  });

  it("scrubs subjects outside the grace window and preserves cooling-off subjects", async () => {
    if (!db) return;
    await db.delete(user).where(inArray(user.id, [...subjectIds]));
    await db.insert(user).values([
      {
        id: eligibleId,
        name: "Eligible Subject",
        email: "eligible-deletion-purge@lax.bid",
        image: "https://example.com/eligible.png",
        deletionRequestedAt: new Date(now.getTime() - 31 * 24 * 60 * 60_000),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: coolingOffId,
        name: "Cooling Off Subject",
        email: "cooling-deletion-purge@lax.bid",
        image: "https://example.com/cooling.png",
        deletionRequestedAt: new Date(now.getTime() - 29 * 24 * 60 * 60_000),
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await expect(purgeDeletedSubjectsBatch(db, now)).resolves.toBe(1);
    const subjects = await db
      .select({ id: user.id, name: user.name, email: user.email, image: user.image })
      .from(user)
      .where(inArray(user.id, [...subjectIds]));

    expect(subjects).toEqual(
      expect.arrayContaining([
        {
          id: eligibleId,
          name: "[deleted]",
          email: `deleted+${eligibleId}@purged.invalid`,
          image: null,
        },
        {
          id: coolingOffId,
          name: "Cooling Off Subject",
          email: "cooling-deletion-purge@lax.bid",
          image: "https://example.com/cooling.png",
        },
      ]),
    );
  });
});
