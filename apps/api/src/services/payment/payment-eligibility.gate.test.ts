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
  it("a personal buyer is held until verified", async () => {
    await expect(
      new PaymentEligibilityGate(account("individual"), identity("pending")).check(input),
    ).resolves.toEqual({ kind: "held", reason: "identity_verification_required" });
    await expect(
      new PaymentEligibilityGate(account("individual"), identity("approved")).check(input),
    ).resolves.toEqual({ kind: "payable" });
  });

  it("a buyer with no identity record at all counts as unverified (held)", async () => {
    await expect(
      new PaymentEligibilityGate(account("individual"), identity(null)).check(input),
    ).resolves.toEqual({ kind: "held", reason: "identity_verification_required" });
  });

  it("where no identity provider can verify anyone, identity is not asked for", async () => {
    await expect(
      new PaymentEligibilityGate(account("individual"), null).check(input),
    ).resolves.toEqual({ kind: "payable" });
  });

  it("an archived organisation is refused", async () => {
    await expect(
      new PaymentEligibilityGate(account("organisation", "archived"), identity(null)).check(input),
    ).resolves.toEqual({ kind: "refused", reason: "organisation_closed" });
  });

  it("fails closed: an account that cannot be read stops the payment", async () => {
    const gate = new PaymentEligibilityGate({ findById: vi.fn(async () => null) }, null);
    await expect(gate.check(input)).rejects.toThrow("payment_buyer_account_not_found");
    const broken = new PaymentEligibilityGate(
      { findById: vi.fn().mockRejectedValue(new Error("db down")) },
      null,
    );
    await expect(broken.check(input)).rejects.toThrow("db down");
  });
});
