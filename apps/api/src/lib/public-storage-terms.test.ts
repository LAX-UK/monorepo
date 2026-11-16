import type { Database } from "@auction/db";
import type { StorageTermsRecord } from "@auction/persistence/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findTermsInForce = vi.fn();
const terms = { findTermsInForce };

import { listPlaceStorageTerms, storageTermsTextForVenue } from "./public-storage-terms.js";

const RECORD: StorageTermsRecord = {
  id: "t1",
  venueId: "v1",
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 300,
  largeDailyPence: 600,
  handlingFeePence: 0,
  effectiveFrom: "2026-10-01",
  reason: "Launch",
  createdByUserId: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  cancelledAt: null,
};
const NOW = new Date("2026-11-15T12:00:00Z");

beforeEach(() => findTermsInForce.mockReset());

describe("the storage terms a visitor reads", () => {
  it("states a working-day count in working days", async () => {
    findTermsInForce.mockResolvedValue({ ...RECORD, countMode: "working" });
    await expect(storageTermsTextForVenue(terms, "v1", NOW)).resolves.toMatch(
      /^Storage is free for 14 working days after your payment clears\./,
    );
  });

  it("reads the terms in force on the London day, as the lot page copy", async () => {
    findTermsInForce.mockResolvedValue(RECORD);
    await expect(storageTermsTextForVenue(terms, "v1", NOW)).resolves.toBe(
      "Storage is free for 14 days after your payment clears. After that it is £3 a day for each work, or £6 for works over 150 cm on any side, plus VAT where it applies.",
    );
    expect(findTermsInForce).toHaveBeenCalledWith("v1", "2026-11-15");
  });

  it("reads the terms in force when an open sale closes, not today's (ST9)", async () => {
    findTermsInForce.mockResolvedValue(RECORD);
    // A sale that has already closed falls back to today; a later close day is read in London time
    // (23:30 UTC on 1 Jul 2027 is already 2 Jul in BST).
    await storageTermsTextForVenue(terms, "v1", NOW, new Date("2026-06-30T23:30:00Z"));
    expect(findTermsInForce).toHaveBeenLastCalledWith("v1", "2026-11-15");
    await storageTermsTextForVenue(terms, "v1", NOW, new Date("2026-11-30T23:30:00Z"));
    expect(findTermsInForce).toHaveBeenLastCalledWith("v1", "2026-11-30");
    await storageTermsTextForVenue(terms, "v1", NOW, new Date("2027-07-01T23:30:00Z"));
    expect(findTermsInForce).toHaveBeenLastCalledWith("v1", "2027-07-02");
  });

  it("is null when the place has set none", async () => {
    findTermsInForce.mockResolvedValue(null);
    await expect(storageTermsTextForVenue(terms, "v1", NOW)).resolves.toBeNull();
  });

  it("lists each bookable place that has terms, in name order, and skips the rest", async () => {
    const rows = [
      { venueId: "v1", placeName: "LAX Gallery" },
      { venueId: "v2", placeName: "LAX Marylebone" },
    ];
    const db = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({ where: () => ({ orderBy: async () => rows }) }),
        }),
      }),
    } as unknown as Database;
    findTermsInForce.mockImplementation(async (venueId: string) =>
      venueId === "v1" ? RECORD : null,
    );
    const list = await listPlaceStorageTerms(db, terms, NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ placeName: "LAX Gallery" });
  });
});
