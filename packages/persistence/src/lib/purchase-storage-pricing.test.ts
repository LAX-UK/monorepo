import type { Database } from "@auction/db";
import { describe, expect, it } from "vitest";
import { readLotStoragePricing } from "./purchase-storage-pricing.js";

const TERMS_ROW = {
  id: "t1",
  freeDays: 14,
  countMode: "working",
  standardDailyPence: 300,
  largeDailyPence: null,
  handlingFeePence: 500,
  effectiveFrom: "2026-10-01",
};

/** A db that answers the three reads in order: terms, extension totals, waivers. */
function fakeDb(answers: unknown[][]): Database {
  let call = 0;
  const answer = () => answers[call++] ?? [];
  const chain = {
    from: () => chain,
    // A read ends at `where` (terms, waivers) or at `groupBy` (extension totals).
    where: () => {
      const rows = answer();
      return Object.assign(Promise.resolve(rows), { groupBy: () => Promise.resolve(rows) });
    },
  };
  return { select: () => chain } as unknown as Database;
}

describe("readLotStoragePricing", () => {
  it("reads nothing for no lots", async () => {
    expect((await readLotStoragePricing(fakeDb([]), [])).size).toBe(0);
  });

  it("joins each lot's terms, extension total, waiver and large flag", async () => {
    const db = fakeDb([[TERMS_ROW], [{ lotId: "a", days: 9 }], [{ lotId: "b" }]]);
    const pricing = await readLotStoragePricing(db, [
      { lotId: "a", storageTermsId: "t1", large: true },
      { lotId: "b", storageTermsId: "t1", large: false },
      { lotId: "c", storageTermsId: null, large: false },
    ]);
    const terms = {
      freeDays: 14,
      countMode: "working",
      standardDailyPence: 300,
      largeDailyPence: null,
      handlingFeePence: 500,
      effectiveFrom: "2026-10-01",
    };
    expect(pricing.get("a")).toEqual({ terms, large: true, extensionDays: 9, waived: false });
    expect(pricing.get("b")).toEqual({ terms, large: false, extensionDays: 0, waived: true });
    // Won before the first terms: no terms recorded, so the legacy rule applies.
    expect(pricing.get("c")).toEqual({
      terms: null,
      large: false,
      extensionDays: 0,
      waived: false,
    });
  });
});
