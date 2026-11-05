import type { LegalEntity } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { PaymentEligibilityGate } from "./payment-eligibility.gate.js";

const account = (kind: LegalEntity["kind"], status: LegalEntity["status"] = "approved") => ({
  findById: vi.fn(async () => ({ id: "le-1", kind, status }) as LegalEntity),
});
const identity = (kycStatus: "unverified" | "pending" | "approved" | "rejected" | null) => ({
  findBidActorEligibility: vi.fn(async () =>
    kycStatus ? { emailVerified: true, kycStatus } : null,
  ),
});
const input = { payerUserId: "user-1", buyerLegalEntityId: "le-1" };

describe("PaymentEligibilityGate", () => {
  it("a personal buyer must be verified to pay", async () => {
    await expect(
      new PaymentEligibilityGate(account("individual"), identity("pending")).refusal(input),
    ).resolves.toBe("identity_verification_required");
    await expect(
      new PaymentEligibilityGate(account("individual"), identity("approved")).refusal(input),
    ).resolves.toBeNull();
  });

  it("a buyer with no identity record at all counts as unverified", async () => {
    await expect(
      new PaymentEligibilityGate(account("individual"), identity(null)).refusal(input),
    ).resolves.toBe("identity_verification_required");
  });

  it("where no identity provider can verify anyone, identity is not asked for", async () => {
    await expect(
      new PaymentEligibilityGate(account("individual"), null).refusal(input),
    ).resolves.toBeNull();
  });

  it("an archived organisation cannot pay", async () => {
    await expect(
      new PaymentEligibilityGate(account("organisation", "archived"), identity(null)).refusal(
        input,
      ),
    ).resolves.toBe("organisation_closed");
  });

  it("fails closed: an account that cannot be read stops the payment", async () => {
    const gate = new PaymentEligibilityGate({ findById: vi.fn(async () => null) }, null);
    await expect(gate.refusal(input)).rejects.toThrow("payment_buyer_account_not_found");
    const broken = new PaymentEligibilityGate(
      { findById: vi.fn().mockRejectedValue(new Error("db down")) },
      null,
    );
    await expect(broken.refusal(input)).rejects.toThrow("db down");
  });
});
