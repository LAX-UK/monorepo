import type { LegalEntityStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { paymentEligibilityRefusal } from "./payment-eligibility.js";

const org = (accountStatus: LegalEntityStatus) =>
  paymentEligibilityRefusal({ accountKind: "organisation", accountStatus, payerKycStatus: null });

describe("paymentEligibilityRefusal", () => {
  it.each(["rejected", "archived"] as const)("a %s organisation cannot pay", (status) => {
    expect(org(status)).toBe("organisation_closed");
  });

  it.each(["approved", "restricted", "connect_pending", "docs_requested"] as const)(
    "a %s organisation can pay its invoices",
    (status) => {
      expect(org(status)).toBeNull();
    },
  );

  it.each(["unverified", "pending", "rejected"] as const)(
    "a personal buyer whose identity is %s cannot pay",
    (kyc) => {
      expect(
        paymentEligibilityRefusal({
          accountKind: "individual",
          accountStatus: "approved",
          payerKycStatus: kyc,
        }),
      ).toBe("identity_verification_required");
    },
  );

  it("a verified personal buyer can pay; the check is skipped where it cannot be made", () => {
    const base = { accountKind: "individual" as const, accountStatus: "approved" as const };
    expect(paymentEligibilityRefusal({ ...base, payerKycStatus: "approved" })).toBeNull();
    expect(paymentEligibilityRefusal({ ...base, payerKycStatus: null })).toBeNull();
  });

  it("an organisation's payer is not asked for personal identity (the organisation is checked)", () => {
    expect(
      paymentEligibilityRefusal({
        accountKind: "organisation",
        accountStatus: "approved",
        payerKycStatus: "unverified",
      }),
    ).toBeNull();
  });
});
