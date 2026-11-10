import { createIdentityDb } from "@auction/identity-db";
import { user } from "@auction/identity-db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleIdentitySubjectRepository } from "./drizzle-identity-subject-repository.js";

const DATABASE_URL = process.env.DATABASE_URL;
const NOW = new Date("2026-11-10T09:00:00.000Z");
const LATER = new Date("2026-11-10T10:00:00.000Z");
const subjectId = "90000000-0000-4000-8000-000000000352";
const otherSubjectId = "90000000-0000-4000-8000-000000000353";

describe.skipIf(!DATABASE_URL)("identity time zone preference", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const subjects = db ? new DrizzleIdentitySubjectRepository(db) : undefined;

  beforeEach(async () => {
    if (!db) return;
    await db.delete(user).where(inArray(user.id, [subjectId, otherSubjectId]));
    await db.insert(user).values([
      { id: subjectId, name: "Zone", email: "time-zone@lax.bid", createdAt: NOW, updatedAt: NOW },
      {
        id: otherSubjectId,
        name: "Other",
        email: "time-zone-other@lax.bid",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(user).where(inArray(user.id, [subjectId, otherSubjectId]));
  });

  it("starts on automatic with no zone", async () => {
    expect(await subjects?.readTimeZone(subjectId)).toEqual({ mode: "automatic", zone: null });
    expect(await subjects?.readTimeZone("nobody")).toBeNull();
  });

  it("saves a fixed city, then goes back to automatic with the device's zone", async () => {
    expect(
      await subjects?.updateTimeZone(null, subjectId, { mode: "fixed", zone: "Asia/Tokyo" }, NOW),
    ).toEqual({ mode: "fixed", zone: "Asia/Tokyo" });
    expect(
      await subjects?.updateTimeZone(
        null,
        subjectId,
        { mode: "automatic", deviceZone: "Europe/Paris" },
        LATER,
      ),
    ).toEqual({ mode: "automatic", zone: "Europe/Paris" });
    expect(await subjects?.readTimeZone(subjectId)).toEqual({
      mode: "automatic",
      zone: "Europe/Paris",
    });
  });

  it("answers null for a person who does not exist", async () => {
    expect(
      await subjects?.updateTimeZone(null, "nobody", { mode: "fixed", zone: "Asia/Tokyo" }, NOW),
    ).toBeNull();
  });

  it("updates the device zone only while automatic, and only when it changed", async () => {
    expect(await subjects?.updateDeviceZone(null, subjectId, "Asia/Tokyo", NOW)).toEqual({
      mode: "automatic",
      zone: "Asia/Tokyo",
    });
    expect(await subjects?.updateDeviceZone(null, subjectId, "Asia/Tokyo", LATER)).toBeNull();

    await subjects?.updateTimeZone(null, subjectId, { mode: "fixed", zone: "Europe/Paris" }, LATER);
    expect(await subjects?.updateDeviceZone(null, subjectId, "Asia/Tokyo", LATER)).toBeNull();
    expect(await subjects?.readTimeZone(subjectId)).toEqual({
      mode: "fixed",
      zone: "Europe/Paris",
    });
  });

  it("leaves other people untouched", async () => {
    await subjects?.updateTimeZone(null, subjectId, { mode: "fixed", zone: "Asia/Tokyo" }, NOW);
    expect(await subjects?.readTimeZone(otherSubjectId)).toEqual({ mode: "automatic", zone: null });
  });

  it("refuses, in the database, a fixed choice with no zone and a zone that names no place", async () => {
    if (!db) return;
    await expect(
      db.update(user).set({ timeZoneMode: "fixed", timeZone: null }).where(eq(user.id, subjectId)),
    ).rejects.toThrow();
    for (const zone of ["UTC", "Etc/GMT+5", "London"]) {
      await expect(
        db.update(user).set({ timeZone: zone }).where(eq(user.id, subjectId)),
      ).rejects.toThrow();
    }
  });
});
