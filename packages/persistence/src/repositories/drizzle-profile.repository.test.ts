import { bidUserProfile, user } from "@auction/db/schema";
import { describe, expect, it, vi } from "vitest";
import { DrizzleProfileRepository } from "./drizzle-profile.repository.js";

describe("DrizzleProfileRepository.getProfile", () => {
  it("selects twoFactorEnabled from the user row", async () => {
    const limit = vi.fn().mockResolvedValue([
      {
        id: "u1",
        email: "e@e.com",
        name: "N",
        mobile: "+447400123456",
        mobileCountry: "GB",
        image: null,
        role: "client",
        staffRole: null,
        emailVerified: true,
        emailStatus: "ok",
        emailStatusChangedAt: null,
        pendingNewEmail: null,
        hasSeenActingContextTooltip: false,
        kycStatus: "unverified",
        signupPersona: null,
        deletionRequestedAt: null,
        twoFactorEnabled: true,
      },
    ]);
    const where = vi.fn().mockReturnValue({ limit });
    const leftJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ leftJoin });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    const repo = new DrizzleProfileRepository(db);
    const row = await repo.getProfile("u1");

    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        twoFactorEnabled: user.twoFactorEnabled,
      }),
    );
    expect(from).toHaveBeenCalledWith(user);
    expect(where).toHaveBeenCalled();
    expect(row?.mobile).toBe("+447400123456");
    expect(row?.mobileCountry).toBe("GB");
    expect(row?.twoFactorEnabled).toBe(true);
  });
});

describe("DrizzleProfileRepository.updateProfile", () => {
  function createDbMock() {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const returning = vi.fn().mockResolvedValue([{ userId: "u1" }]);
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
    const insertSelect = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const sourceWhere = vi.fn().mockReturnValue({ query: "source" });
    const sourceFrom = vi.fn().mockReturnValue({ where: sourceWhere });
    const select = vi.fn().mockReturnValue({ from: sourceFrom });
    const tx = { insert, select, update };
    const transaction = vi.fn(async (fn: (value: typeof tx) => Promise<void>) => fn(tx));
    return { db: { transaction } as never, update, set };
  }

  it("writes mobile to bid_user_profile", async () => {
    const { db, update, set } = createDbMock();

    const repo = new DrizzleProfileRepository(db);
    await repo.updateProfile("u1", { mobile: "+447400123456", mobileCountry: "GB" });

    expect(update).toHaveBeenCalledWith(bidUserProfile);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        mobile: "+447400123456",
        mobileCountry: "GB",
      }),
    );
  });

  it("clears mobile with null", async () => {
    const { db, set } = createDbMock();

    const repo = new DrizzleProfileRepository(db);
    await repo.updateProfile("u1", { mobile: null, mobileCountry: null });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        mobile: null,
        mobileCountry: null,
      }),
    );
  });
});
