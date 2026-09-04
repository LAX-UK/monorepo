import { bidIdentityDirectory, bidUserProfile } from "@auction/db/schema";
import { describe, expect, it, vi } from "vitest";
import { DrizzleCategoryInterestsEligibilityReader } from "./drizzle-category-interests-eligibility.reader.js";

function createDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });
  const select = vi.fn().mockReturnValue({ from });
  return { db: { select } as never, select, from, innerJoin, where };
}

describe("DrizzleCategoryInterestsEligibilityReader", () => {
  it("returns null when the Bid profile has not been projected", async () => {
    const { db, from, innerJoin } = createDb([]);
    const reader = new DrizzleCategoryInterestsEligibilityReader(db);

    await expect(reader.getProfile("missing")).resolves.toBeNull();
    expect(from).toHaveBeenCalledWith(bidUserProfile);
    expect(innerJoin).toHaveBeenCalledWith(bidIdentityDirectory, expect.anything());
  });

  it("maps only the local eligibility facts", async () => {
    const { db, select } = createDb([
      {
        role: "client",
        suspendedAt: new Date("2026-08-20T12:00:00.000Z"),
        emailVerified: true,
        signupPersona: "individual",
      },
    ]);
    const reader = new DrizzleCategoryInterestsEligibilityReader(db);

    await expect(reader.getProfile("u1")).resolves.toEqual({
      role: "client",
      suspended: true,
      emailVerified: true,
      signupPersona: "individual",
    });
    expect(select).toHaveBeenCalledWith({
      role: bidUserProfile.role,
      suspendedAt: bidUserProfile.suspendedAt,
      emailVerified: bidIdentityDirectory.emailVerified,
      signupPersona: bidUserProfile.signupPersona,
    });
  });

  it("normalizes an unsupported projected persona to legacy null", async () => {
    const { db } = createDb([
      {
        role: "client",
        suspendedAt: null,
        emailVerified: true,
        signupPersona: "unexpected",
      },
    ]);
    const reader = new DrizzleCategoryInterestsEligibilityReader(db);

    await expect(reader.getProfile("u1")).resolves.toMatchObject({
      suspended: false,
      signupPersona: null,
    });
  });
});
