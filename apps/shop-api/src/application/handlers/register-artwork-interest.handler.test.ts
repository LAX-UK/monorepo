import { describe, expect, it, vi } from "vitest";
import { createRegisterArtworkInterestHandler } from "./register-artwork-interest.handler.js";

describe("createRegisterArtworkInterestHandler", () => {
  it("evaluates notify-me policy before registering interest", async () => {
    const registerInterest = vi.fn(async () => "registered" as const);
    const handler = createRegisterArtworkInterestHandler({
      loadInterestContext: vi.fn(async () => ({
        artworkId: "art-1",
        artworkSlug: "warm-basket",
        eligibleForEditionAllocation: true,
        printPricePence: 1000,
        editionsAvailable: 0,
        saleState: "for_sale" as const,
      })),
      registerInterest,
      getInterestStatus: vi.fn(),
    });
    await expect(
      handler({ artworkSlug: "warm-basket", identitySubjectId: "sub-1", intent: "notify_me" }),
    ).resolves.toBe("registered");
    expect(registerInterest).toHaveBeenCalledWith({
      artworkId: "art-1",
      artworkSlug: "warm-basket",
      identitySubjectId: "sub-1",
      intent: "notify_me",
    });
  });
});
