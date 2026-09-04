import { describe, expect, it, vi } from "vitest";
import { DrizzleBidUserContextLoader } from "./drizzle-bid-user-context.loader.js";

function databaseReturning(row: Record<string, unknown>) {
  const limit = vi.fn().mockResolvedValue([row]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { select: vi.fn(() => ({ from })) };
}

describe("DrizzleBidUserContextLoader", () => {
  it("uses the product lifecycle projection without an Identity fallback", async () => {
    const identityDisabledAt = new Date("2026-08-01T00:00:00.000Z");
    const profile = {
      role: "client",
      staffRole: null,
      suspendedAt: null,
      identityDisabledAt,
      mergedIntoSubjectId: "canonical",
    };
    const db = databaseReturning(profile);

    const context = await new DrizzleBidUserContextLoader(db as never).loadContext("retired");

    expect(context).toEqual(profile);
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
    const db = databaseReturning(profile);

    await expect(
      new DrizzleBidUserContextLoader(db as never).loadContext("bid-suspended"),
    ).resolves.toEqual(profile);
  });
});
