import { bidUserProfile, user } from "@auction/db/schema";
import { describe, expect, it, vi } from "vitest";
import { ensureBidUserProfile, writeBidUserProfile } from "./bid-user-profile-sync.js";

function createDbMock() {
  const sourceWhere = vi.fn().mockResolvedValue([
    {
      userId: "u-1",
      identityDisabledAt: null,
      mergedIntoSubjectId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  const sourceFrom = vi.fn().mockReturnValue({ where: sourceWhere });
  const select = vi.fn().mockReturnValue({ from: sourceFrom });
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });
  return {
    db: { insert, select, update } as never,
    insert,
    onConflictDoUpdate,
    update,
    set,
  };
}

describe("Bid profile synchronization", () => {
  it("provisions from legacy state idempotently", async () => {
    const { db, insert, onConflictDoUpdate } = createDbMock();

    await ensureBidUserProfile(db, "u-1");
    await ensureBidUserProfile(db, "u-1");

    expect(insert).toHaveBeenNthCalledWith(1, bidUserProfile);
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
  });

  it("writes only the authoritative profile table", async () => {
    const { db, update, set } = createDbMock();

    await writeBidUserProfile(db, "u-1", { kycStatus: "approved" });

    expect(update).toHaveBeenCalledWith(bidUserProfile);
    expect(update).not.toHaveBeenCalledWith(user);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        kycStatus: "approved",
        updatedAt: expect.any(Date),
      }),
    );
  });
});
