import { describe, expect, it, vi } from "vitest";
import { DrizzleBidActorEligibilityReader } from "./drizzle-bid-actor-eligibility.reader.js";

function createDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const query = { leftJoin: vi.fn(), where };
  query.leftJoin.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  const select = vi.fn().mockReturnValue({ from });
  return { db: { select } as never, select, from, query, where, limit };
}

describe("DrizzleBidActorEligibilityReader", () => {
  it("returns null when the Identity directory subject is missing", async () => {
    const { db } = createDb([]);
    const reader = new DrizzleBidActorEligibilityReader(db);

    await expect(reader.findBidActorEligibility("missing")).resolves.toBeNull();
  });

  it("fails closed when the Bid profile has not been projected", async () => {
    const { db } = createDb([{ emailVerified: true, kycStatus: null }]);
    const reader = new DrizzleBidActorEligibilityReader(db);

    await expect(reader.findBidActorEligibility("user-1")).resolves.toEqual({
      emailVerified: true,
      kycStatus: "unverified",
    });
  });

  it("preserves an unverified directory email before approved KYC", async () => {
    const { db } = createDb([{ emailVerified: false, kycStatus: "approved" }]);
    const reader = new DrizzleBidActorEligibilityReader(db);

    await expect(reader.findBidActorEligibility("user-1")).resolves.toEqual({
      emailVerified: false,
      kycStatus: "approved",
    });
  });

  it("returns approved eligibility from the directory and profile", async () => {
    const { db } = createDb([{ emailVerified: true, kycStatus: "approved" }]);
    const reader = new DrizzleBidActorEligibilityReader(db);

    await expect(reader.findBidActorEligibility("user-1")).resolves.toEqual({
      emailVerified: true,
      kycStatus: "approved",
    });
  });
});
