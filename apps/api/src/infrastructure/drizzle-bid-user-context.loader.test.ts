import { describe, expect, it, vi } from "vitest";
import { DrizzleBidUserContextLoader } from "./drizzle-bid-user-context.loader.js";

function databaseReturning(row: Record<string, unknown>) {
  const limit = vi.fn().mockResolvedValue([row]);
  const where = vi.fn(() => ({ limit }));
  const leftJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ leftJoin }));
  return { select: vi.fn(() => ({ from })) };
}

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
    const db = databaseReturning({
      ...profile,
      profileIdentityDisabledAt: profile.identityDisabledAt,
      profileMergedIntoSubjectId: profile.mergedIntoSubjectId,
      identityDisabledAt: legacy.identityDisabledAt,
      mergedIntoSubjectId: legacy.mergedIntoSubjectId,
    });

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
    const db = databaseReturning({
      ...profile,
      profileIdentityDisabledAt: profile.identityDisabledAt,
      profileMergedIntoSubjectId: profile.mergedIntoSubjectId,
    });

    await expect(
      new DrizzleBidUserContextLoader(db as never).loadContext("bid-suspended"),
    ).resolves.toEqual(profile);
  });
});
