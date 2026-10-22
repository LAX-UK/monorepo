import { describe, expect, it, vi } from "vitest";
import type { EnquirySender } from "../enquiry-sender.js";
import { createRegisterArtworkInterestHandler } from "./register-artwork-interest.handler.js";

const ACCOUNT: EnquirySender = {
  kind: "account",
  identitySubjectId: "sub-1",
  contactName: null,
  contactEmail: null,
};

describe("createRegisterArtworkInterestHandler", () => {
  it("evaluates notify-me policy before registering interest", async () => {
    const registerInterest = vi.fn(async () => "registered" as const);
    const handler = createRegisterArtworkInterestHandler({
      loadInterestContext: vi.fn(async () => ({
        artworkId: "art-1",
        artworkSlug: "warm-basket",
        salesChannel: "shop" as const,
        eligibleForEditionAllocation: true,
        printPricePence: 1000,
        editionsAvailable: 0,
        saleState: "for_sale" as const,
      })),
      registerInterest,
      getInterestStatus: vi.fn(),
    });
    await expect(
      handler({ artworkSlug: "warm-basket", sender: ACCOUNT, intent: "notify_me" }),
    ).resolves.toBe("registered");
    expect(registerInterest).toHaveBeenCalledWith({
      artworkId: "art-1",
      artworkSlug: "warm-basket",
      salesChannel: "shop",
      sender: ACCOUNT,
      intent: "notify_me",
    });
  });
});
