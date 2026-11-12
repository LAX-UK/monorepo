import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidIdentityDirectory, notificationPreference, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleNotificationPreferenceRepository } from "./drizzle-notification-preference.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("quiet hours read the LAX Account time zone (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const subject = `qh_zone_${run}`;
  const NOW = new Date("2026-11-10T09:00:00Z");
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleNotificationPreferenceRepository(db);

  beforeAll(async () => {
    await db.insert(user).values({
      id: subject,
      name: "Quiet Hours",
      email: `${subject}@example.test`,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await db.insert(bidIdentityDirectory).values({
      subjectId: subject,
      email: `${subject}@example.test`,
      name: "Quiet Hours",
      identityCreatedAt: NOW,
    });
    await db.insert(notificationPreference).values({
      userId: subject,
      quietStart: "21:00",
      quietEnd: "06:00",
      quietTimeZone: "Europe/London",
    });
  });

  afterAll(async () => {
    await db.delete(notificationPreference).where(eq(notificationPreference.userId, subject));
    await db.delete(bidIdentityDirectory).where(eq(bidIdentityDirectory.subjectId, subject));
    await db.delete(user).where(eq(user.id, subject));
  });

  async function setAccountZone(mode: "automatic" | "fixed", timeZone: string | null) {
    await db
      .update(bidIdentityDirectory)
      .set({ timeZoneMode: mode, timeZone })
      .where(eq(bidIdentityDirectory.subjectId, subject));
  }

  it("uses the zone saved with the hours until Account has one", async () => {
    await setAccountZone("automatic", null);
    expect((await repo.getForUser(subject))?.quietTimeZone).toBe("Europe/London");
  });

  it("uses a fixed Account city", async () => {
    await setAccountZone("fixed", "Australia/Sydney");
    expect((await repo.getForUser(subject))?.quietTimeZone).toBe("Australia/Sydney");
  });

  it("uses the device zone Account last stored while automatic", async () => {
    await setAccountZone("automatic", "Asia/Tokyo");
    expect((await repo.getForUser(subject))?.quietTimeZone).toBe("Asia/Tokyo");
  });

  it("keeps the Account zone when the preferences are saved", async () => {
    await setAccountZone("fixed", "Australia/Sydney");
    const saved = await repo.upsert(subject, { quietStart: "22:00", quietEnd: "07:00" });
    expect(saved.quietTimeZone).toBe("Australia/Sydney");
    expect(saved.quietStart).toBe("22:00");
  });
});
