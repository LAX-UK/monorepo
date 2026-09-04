import { bidIdentityDirectory, bidUserProfile, user } from "@auction/db/schema";
import { describe, expect, it, vi } from "vitest";
import {
  ensureBidUserProfile,
  provisionBidUserProfileShell,
  writeBidUserProfile,
} from "./bid-user-profile-sync.js";

function createDbMock(options: { existingProfile?: boolean } = {}) {
  const profileWhere = vi
    .fn()
    .mockResolvedValue(options.existingProfile ? [{ userId: "u-1" }] : []);
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
  const profileFrom = vi.fn().mockReturnValue({ where: profileWhere });
  const select = vi.fn().mockReturnValue({
    from: vi.fn((table) => (table === bidUserProfile ? profileFrom(table) : sourceFrom(table))),
  });
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoNothing, onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });
  return {
    db: { insert, select, update } as never,
    insert,
    values,
    profileFrom,
    sourceFrom,
    onConflictDoNothing,
    onConflictDoUpdate,
    update,
    set,
  };
}

describe("Bid profile synchronization", () => {
  it("provisions from the local Identity directory idempotently", async () => {
    const { db, insert, sourceFrom, onConflictDoUpdate } = createDbMock();

    await ensureBidUserProfile(db, "u-1");
    await ensureBidUserProfile(db, "u-1");

    expect(insert).toHaveBeenNthCalledWith(1, bidUserProfile);
    expect(sourceFrom).toHaveBeenCalledWith(bidIdentityDirectory);
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
  });

  it("returns without consulting the directory when the profile already exists", async () => {
    const { db, insert, profileFrom, sourceFrom } = createDbMock({ existingProfile: true });

    await ensureBidUserProfile(db, "u-1");

    expect(profileFrom).toHaveBeenCalledWith(bidUserProfile);
    expect(sourceFrom).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("provisions a trusted profile shell without writing the Identity directory", async () => {
    const { db, insert, values, onConflictDoNothing } = createDbMock();
    const createdAt = new Date("2026-08-20T08:00:00.000Z");

    await provisionBidUserProfileShell(db, "u-1", createdAt);

    expect(insert).toHaveBeenCalledWith(bidUserProfile);
    expect(insert).not.toHaveBeenCalledWith(bidIdentityDirectory);
    expect(values).toHaveBeenCalledWith({
      userId: "u-1",
      createdAt,
      updatedAt: createdAt,
    });
    expect(onConflictDoNothing).toHaveBeenCalledWith({ target: bidUserProfile.userId });
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
