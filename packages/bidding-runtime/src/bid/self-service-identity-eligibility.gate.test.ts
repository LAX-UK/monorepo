import type { IBidActorEligibilityReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { SelfServiceIdentityEligibilityGate } from "./self-service-identity-eligibility.gate.js";

describe("SelfServiceIdentityEligibilityGate", () => {
  it("checks email before KYC", async () => {
    const gate = new SelfServiceIdentityEligibilityGate({
      findBidActorEligibility: vi
        .fn()
        .mockResolvedValue({ emailVerified: false, kycStatus: "unverified" }),
    } as IBidActorEligibilityReader);

    const result = await gate.assertSelfServiceEligible("user-1");

    expect(result.isErr() && [result.error.status, result.error.code]).toEqual([
      403,
      "email_not_verified",
    ]);
  });

  it("fails closed when actor is missing", async () => {
    const gate = new SelfServiceIdentityEligibilityGate({
      findBidActorEligibility: vi.fn().mockResolvedValue(null),
    } as IBidActorEligibilityReader);

    const result = await gate.assertSelfServiceEligible("missing");

    expect(result.isErr() && result.error.code).toBe("kyc_required");
  });
});
