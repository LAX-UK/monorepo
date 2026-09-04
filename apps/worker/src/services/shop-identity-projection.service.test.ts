import { describe, expect, it, vi } from "vitest";
import { ShopIdentityProjectionService } from "./shop-identity-projection.service.js";

describe("ShopIdentityProjectionService", () => {
  it("soft-merges a retired profile atomically", async () => {
    const onConflictDoNothing = vi.fn(async () => undefined);
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const tx = {
      query: {
        shopUserProfile: {
          findFirst: vi.fn(async () => ({
            identitySubjectId: "retired",
            email: "person@example.com",
            name: "Person",
          })),
        },
      },
      insert,
      update,
    };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => Promise<void>) => callback(tx)),
    };
    const service = new ShopIdentityProjectionService(db as never);

    await service.apply("user.identity_merged", {
      schemaVersion: 1,
      subjectId: "canonical",
      retiredSubjectId: "retired",
      mergedAt: "2026-08-03T00:00:00.000Z",
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        identitySubjectId: "canonical",
        email: "person@example.com",
        mergedIntoSubjectId: null,
      }),
    );
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        mergedIntoSubjectId: "canonical",
        disabledAt: new Date("2026-08-03T00:00:00.000Z"),
      }),
    );
  });
});
