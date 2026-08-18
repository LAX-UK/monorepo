import { describe, expect, it, vi } from "vitest";
import { DrizzleBidUserContextLoader } from "./drizzle-bid-user-context.loader.js";

describe("DrizzleBidUserContextLoader", () => {
  it("fails closed on legacy lifecycle state while the local projection catches up", async () => {
    const profile = {
      role: "client",
      staffRole: null,
      suspendedAt: null,
      identityDisabledAt: null,
      mergedIntoSubjectId: null,
    };
    const legacy = {
      ...profile,
      identityDisabledAt: new Date("2026-08-01T00:00:00.000Z"),
      mergedIntoSubjectId: "canonical",
    };
    const db = {
      query: {
        bidUserProfile: { findFirst: vi.fn().mockResolvedValue(profile) },
        user: { findFirst: vi.fn().mockResolvedValue(legacy) },
      },
    };

    const context = await new DrizzleBidUserContextLoader(db as never).loadContext("retired");

    expect(context).toMatchObject({
      identityDisabledAt: legacy.identityDisabledAt,
      mergedIntoSubjectId: "canonical",
    });
  });

  it("preserves Bid suspension independently from Identity lifecycle state", async () => {
    const suspendedAt = new Date("2026-08-02T00:00:00.000Z");
    const profile = {
      role: "client",
      staffRole: null,
      suspendedAt,
      identityDisabledAt: null,
      mergedIntoSubjectId: null,
    };
    const db = {
      query: {
        bidUserProfile: { findFirst: vi.fn().mockResolvedValue(profile) },
        user: { findFirst: vi.fn().mockResolvedValue(profile) },
      },
    };

    await expect(
      new DrizzleBidUserContextLoader(db as never).loadContext("bid-suspended"),
    ).resolves.toEqual(profile);
  });
});
