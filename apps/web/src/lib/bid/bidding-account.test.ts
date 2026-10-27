import { describe, expect, it } from "vitest";
import {
  biddingAccountOverLimit,
  biddingAsLabel,
  resolveBiddingAccount,
  shouldShowBiddingAs,
} from "./bidding-account";

const gallery = {
  id: "le-gallery",
  kind: "organisation" as const,
  displayName: "Northbank Gallery",
  role: "viewer" as const,
};
const personal = { kind: "individual" as const };
const org = { kind: "organisation" as const };

describe("resolveBiddingAccount", () => {
  it("bids as you on a personal account, naming it only for people in an organisation", () => {
    const alone = resolveBiddingAccount({
      acting: { ...gallery, kind: "individual", role: "owner" },
      memberships: [personal],
      authority: null,
    });
    expect(alone).toEqual({ kind: "personal", hasOrganisations: false });
    expect(shouldShowBiddingAs(alone)).toBe(false);

    const member = resolveBiddingAccount({
      acting: { ...gallery, kind: "individual", role: "owner" },
      memberships: [personal, org],
      authority: null,
    });
    expect(member && biddingAsLabel(member)).toBe("Bidding as you");
    expect(shouldShowBiddingAs(member)).toBe(true);
  });

  it("uses the server's answer for an organisation", () => {
    const account = resolveBiddingAccount({
      acting: { ...gallery, role: "buyer_agent" },
      memberships: [personal, org],
      authority: {
        allowed: true,
        role: "buyer_agent",
        viaAuthorisation: true,
        bidLimit: "10000.00",
      },
    });
    expect(account).toEqual({
      kind: "organisation",
      name: "Northbank Gallery",
      allowed: true,
      bidLimit: 10000,
    });
    expect(account && biddingAsLabel(account)).toBe("Bidding as Northbank Gallery");
  });

  it("refuses a viewer and offers the personal account", () => {
    const account = resolveBiddingAccount({
      acting: gallery,
      memberships: [personal, org],
      authority: { allowed: false, role: "viewer", reason: "role_cannot_bid" },
    });
    expect(account).toEqual({
      kind: "organisation",
      name: "Northbank Gallery",
      allowed: false,
      reason: "role_cannot_bid",
      canSwitchToPersonal: true,
    });
    expect(shouldShowBiddingAs(account)).toBe(false);
  });

  it("falls back to the role table when the server's answer is unavailable", () => {
    expect(
      resolveBiddingAccount({ acting: gallery, memberships: [org], authority: null }),
    ).toMatchObject({ allowed: false, reason: "role_cannot_bid", canSwitchToPersonal: false });
    expect(
      resolveBiddingAccount({
        acting: { ...gallery, role: "admin" },
        memberships: [org],
        authority: null,
      }),
    ).toMatchObject({ allowed: true, bidLimit: null });
  });
});

describe("biddingAccountOverLimit", () => {
  const agent = {
    kind: "organisation" as const,
    name: "Northbank Gallery",
    allowed: true as const,
    bidLimit: 5000,
  };

  it("is true only when the next bid is above a buyer agent's limit", () => {
    expect(biddingAccountOverLimit(agent, 5000)).toBe(false);
    expect(biddingAccountOverLimit(agent, 5100)).toBe(true);
    expect(biddingAccountOverLimit({ ...agent, bidLimit: null }, 1_000_000)).toBe(false);
    expect(biddingAccountOverLimit({ kind: "personal", hasOrganisations: true }, 1e9)).toBe(false);
  });
});
