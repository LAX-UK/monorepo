import type { Database } from "@auction/db";
import type { StorageTermsRecord } from "@auction/persistence/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findTermsInForce = vi.fn();
const terms = { findTermsInForce };

import {
  listPlaceStorageTerms,
  storageTermsOfRecord,
  storageTermsTextForVenue,
} from "./public-storage-terms.js";

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
  it("maps a stored version onto the rules' terms", () => {
    expect(storageTermsOfRecord({ ...RECORD, countMode: "working" })).toEqual({
      freeDays: 14,
      dayCount: "working",
      standardDailyPence: 300,
      largeDailyPence: 600,
      handlingFeePence: 0,
      effectiveFrom: "2026-10-01",
    });
  });

  it("reads the terms in force on the London day, as the lot page copy", async () => {
    findTermsInForce.mockResolvedValue(RECORD);
    await expect(storageTermsTextForVenue(terms, "v1", NOW)).resolves.toBe(
      "Storage is free for 14 days after your payment clears. After that it is £3 a day for each work, or £6 for works over 150 cm on any side, plus VAT where it applies.",
    );
    expect(findTermsInForce).toHaveBeenCalledWith("v1", "2026-11-15");
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
