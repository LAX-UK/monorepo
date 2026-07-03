import { user } from "@auction/db/schema";
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
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    const repo = new DrizzleProfileRepository(db);
    const row = await repo.getProfile("u1");

    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        mobile: user.mobile,
        mobileCountry: user.mobileCountry,
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
  it("sets mobile when provided", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = { update } as never;

    const repo = new DrizzleProfileRepository(db);
    await repo.updateProfile("u1", { mobile: "+447400123456", mobileCountry: "GB" });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        mobile: "+447400123456",
        mobileCountry: "GB",
      }),
    );
  });

  it("clears mobile with null", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = { update } as never;

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
