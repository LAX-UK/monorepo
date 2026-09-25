import { bidUserProfile } from "@auction/db/schema";
import { describe, expect, it, vi } from "vitest";
import { DrizzleAccountOnboardingRepository } from "./drizzle-account-onboarding.repository.js";

describe("DrizzleAccountOnboardingRepository", () => {
  it("reads termsAcceptedAt for onboarding status", async () => {
    const limit = vi.fn().mockResolvedValue([{ termsAcceptedAt: new Date("2026-01-01") }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const repo = new DrizzleAccountOnboardingRepository({ select } as never);

    const row = await repo.getStatus("user-1");

    expect(from).toHaveBeenCalledWith(bidUserProfile);
    expect(row?.termsAcceptedAt).toEqual(new Date("2026-01-01"));
  });

  it("writes onboarding fields through bid_user_profile", async () => {
    const whereUpdate = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: whereUpdate });
    const update = vi.fn().mockReturnValue({ set });
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });
    const profileWhere = vi.fn().mockResolvedValue([{ userId: "user-1" }]);
    const profileFrom = vi.fn().mockReturnValue({ where: profileWhere });
    const select = vi.fn().mockReturnValue({ from: profileFrom });
    const db = { insert, select, update } as never;

    const repo = new DrizzleAccountOnboardingRepository(db);
    const termsAcceptedAt = new Date("2026-02-01");
    await repo.completeOnboarding({
      userId: "user-1",
      firstName: "Ada",
      lastName: "Lovelace",
      persona: "individual",
      termsAcceptedAt,
      termsVersion: "conditions-of-business-2026",
      mobile: "+447400123456",
      mobileCountry: "GB",
    });

    expect(update).toHaveBeenCalledWith(bidUserProfile);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Ada",
        lastName: "Lovelace",
        signupPersona: "individual",
        mobile: "+447400123456",
        mobileCountry: "GB",
      }),
    );
  });
});
