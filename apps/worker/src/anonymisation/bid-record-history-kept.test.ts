import { describe, expect, it } from "vitest";
import { BID_ANONYMISATION_RULES } from "./bid-personal-data-policy.js";

/**
 * A converted private sale enquiry is held from erasure on what these records say: who was named
 * on its deal and which checks were opened for them. If the person's own erasure scrubbed any of
 * them first, the hold would lose its evidence.
 */
const KEPT_FOR_THE_DEAL_RECORD = [
  "private_sale_deal",
  "private_sale_deal_party",
  "private_sale_deal_party_history",
  "private_sale_deal_stage_history",
  "domain_events",
  "kyc_verification",
  "kyc_watchlist_screening",
  "source_of_funds",
];

describe("the account erasure rules and the private sale deal record", () => {
  it("never scrub the party history, the deal, or the checks the hold reads", () => {
    const touched = BID_ANONYMISATION_RULES.map((rule) => rule.table);
    for (const table of KEPT_FOR_THE_DEAL_RECORD) {
      expect(touched).not.toContain(table);
    }
  });

  it("scrub the account profile without touching the identity or hold status", () => {
    const profile = BID_ANONYMISATION_RULES.find((rule) => rule.table === "bid_user_profile");
    expect(profile?.treatment).toBe("scrub");
    expect(profile?.fields).not.toContain("kyc_status");
    expect(profile?.fields).not.toContain("aml_hold_status");
  });

  it("run the enquiry rule, which holds the converted enquiry, as a listed rule", () => {
    expect(BID_ANONYMISATION_RULES.map((rule) => rule.table)).toContain("marketing_enquiry");
  });
});
