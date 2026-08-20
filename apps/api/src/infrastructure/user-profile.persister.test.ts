import { beforeEach, describe, expect, it, vi } from "vitest";

const { provisionBidUserProfileShell, writeBidUserProfile } = vi.hoisted(() => ({
  provisionBidUserProfileShell: vi.fn(),
  writeBidUserProfile: vi.fn(),
}));

vi.mock("@auction/persistence/bid-user-profile-sync", () => ({
  provisionBidUserProfileShell,
  writeBidUserProfile,
}));

import { DrizzleUserProfilePersister } from "./user-profile.persister.js";

describe("DrizzleUserProfilePersister", () => {
  beforeEach(() => vi.clearAllMocks());

  it("provisions the Bid profile shell before persisting registration fields", async () => {
    const db = {};
    const persister = new DrizzleUserProfilePersister(db as never);

    const result = await persister.setRegistrationProfile({
      userId: "subject-1",
      firstName: "Ada",
      lastName: "Lovelace",
      persona: "individual",
    });

    expect(result).toEqual({ ok: true });
    expect(provisionBidUserProfileShell).toHaveBeenCalledWith(db, "subject-1", expect.any(Date));
    expect(writeBidUserProfile).toHaveBeenCalledWith(db, "subject-1", {
      firstName: "Ada",
      lastName: "Lovelace",
      mobile: null,
      mobileCountry: null,
      signupPersona: "individual",
    });
    expect(provisionBidUserProfileShell.mock.invocationCallOrder[0]).toBeLessThan(
      writeBidUserProfile.mock.invocationCallOrder[0] as number,
    );
  });
});
