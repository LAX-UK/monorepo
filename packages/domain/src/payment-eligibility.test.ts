import type { LegalEntityStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { paymentEligibility } from "./payment-eligibility.js";

const org = (accountStatus: LegalEntityStatus) =>
  paymentEligibility({ accountKind: "organisation", accountStatus, payerKycStatus: null });

describe("paymentEligibility", () => {
  it.each(["rejected", "archived"] as const)("a %s organisation is refused", (status) => {
    expect(org(status)).toEqual({ kind: "refused", reason: "organisation_closed" });
  });

  it.each(["lead", "docs_requested", "docs_received", "under_review"] as const)(
    "a %s organisation's invoices are held until LAX has checked it",
    (status) => {
      expect(org(status)).toEqual({ kind: "held", reason: "organisation_under_review" });
    },
  );

  it.each(["approved", "restricted", "connect_pending"] as const)(
    "a %s organisation can pay its invoices",
    (status) => {
      expect(org(status)).toEqual({ kind: "payable" });
    },
  );

  it.each(["unverified", "pending", "rejected"] as const)(
    "a personal buyer whose identity is %s is held until they verify it",
    (kyc) => {
      expect(
        paymentEligibility({
          accountKind: "individual",
          accountStatus: "approved",
          payerKycStatus: kyc,
        }),
      ).toEqual({ kind: "held", reason: "identity_verification_required" });
    },
  );

  it("a verified personal buyer can pay; the check is skipped where it cannot be made", () => {
    const base = { accountKind: "individual" as const, accountStatus: "approved" as const };
    expect(paymentEligibility({ ...base, payerKycStatus: "approved" })).toEqual({
      kind: "payable",
    });
    expect(paymentEligibility({ ...base, payerKycStatus: null })).toEqual({ kind: "payable" });
  });

  it("an organisation's payer is not asked for personal identity (the organisation is checked)", () => {
    expect(
      paymentEligibility({
        accountKind: "organisation",
        accountStatus: "approved",
        payerKycStatus: "unverified",
      }),
    ).toEqual({ kind: "payable" });
  });
});
