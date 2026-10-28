import { describe, expect, it } from "vitest";
import { memberAbilities, roleNeedsPersonalIdentity, welcomeCardFor } from "./member-role-guide.js";
import {
  organisationApprovalWaits,
  organisationSetupState,
  organisationUnderReview,
} from "./organisation-setup.js";

describe("memberAbilities", () => {
  it("describes each role from its capabilities", () => {
    expect(memberAbilities("owner")).toEqual([
      "manage_members",
      "bid_freely",
      "sell_works",
      "accept_agreements",
      "pay_purchases",
      "see_payouts",
    ]);
    expect(memberAbilities("consignor")).toEqual(["sell_works"]);
    expect(memberAbilities("buyer_agent")).toEqual(["bid_when_authorised", "see_works"]);
    expect(memberAbilities("finance")).toEqual([
      "follow_consignments",
      "pay_purchases",
      "see_payouts",
      "see_works",
    ]);
    expect(memberAbilities("viewer")).toEqual(["follow_consignments", "see_works"]);
  });
});

describe("welcomeCardFor", () => {
  const base = { invited: true, dismissed: false, identityVerified: false };

  it("is shown once to invited members, until dismissed", () => {
    expect(welcomeCardFor({ ...base, role: "viewer" })).not.toBeNull();
    expect(welcomeCardFor({ ...base, role: "viewer", dismissed: true })).toBeNull();
  });

  it("is not shown to the person who set the organisation up", () => {
    expect(welcomeCardFor({ ...base, role: "owner", invited: false })).toBeNull();
  });

  it("adds the identity step for buyer agents and consignors only", () => {
    expect(welcomeCardFor({ ...base, role: "buyer_agent" })?.identityStep).toBe(true);
    expect(welcomeCardFor({ ...base, role: "consignor" })?.identityStep).toBe(true);
    expect(welcomeCardFor({ ...base, role: "viewer" })?.identityStep).toBe(false);
    expect(welcomeCardFor({ ...base, role: "finance" })?.identityStep).toBe(false);
    expect(welcomeCardFor({ ...base, role: "admin" })?.identityStep).toBe(false);
  });

  it("drops the identity step once the member is verified", () => {
    expect(
      welcomeCardFor({ ...base, role: "consignor", identityVerified: true })?.identityStep,
    ).toBe(false);
  });

  it("needs personal identity only from members who act without running the organisation", () => {
    expect(roleNeedsPersonalIdentity("buyer_agent")).toBe(true);
    expect(roleNeedsPersonalIdentity("consignor")).toBe(true);
    expect(roleNeedsPersonalIdentity("owner")).toBe(false);
    expect(roleNeedsPersonalIdentity("viewer")).toBe(false);
  });
});

describe("organisation setup", () => {
  it("names the state while setup is unfinished", () => {
    expect(organisationSetupState({ status: "docs_requested", payoutsReady: false })).toBe(
      "documents_requested",
    );
    expect(organisationSetupState({ status: "under_review", payoutsReady: false })).toBe(
      "documents_under_review",
    );
    expect(organisationSetupState({ status: "connect_pending", payoutsReady: false })).toBe(
      "payouts_not_set_up",
    );
    expect(organisationSetupState({ status: "approved", payoutsReady: true })).toBeNull();
  });

  it("says Under review only while documents are being checked", () => {
    expect(organisationUnderReview("docs_received")).toBe(true);
    expect(organisationUnderReview("under_review")).toBe(true);
    expect(organisationUnderReview("docs_requested")).toBe(false);
    expect(organisationUnderReview("approved")).toBe(false);
  });

  it("holds bidding and sending submissions until approval, as the server does", () => {
    expect(organisationApprovalWaits("under_review")).toEqual({ bidding: true, submissions: true });
    expect(organisationApprovalWaits("connect_pending")).toEqual({
      bidding: false,
      submissions: true,
    });
    expect(organisationApprovalWaits("approved")).toEqual({ bidding: false, submissions: false });
  });
});
