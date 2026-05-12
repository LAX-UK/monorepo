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
        twoFactorEnabled: user.twoFactorEnabled,
      }),
    );
    expect(from).toHaveBeenCalledWith(user);
    expect(where).toHaveBeenCalled();
    expect(row?.twoFactorEnabled).toBe(true);
  });
});
