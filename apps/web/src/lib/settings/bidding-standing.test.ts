import type { LegalEntityMemberRole, OrganisationBiddingLimitsView } from "@auction/types";
import { describe, expect, it } from "vitest";
import { type BiddingOrganisation, biddingRows } from "./bidding-standing";

const LIMITS: OrganisationBiddingLimitsView = {
  canManage: true,
  organisation: {
    limit: "250000.00",
    exposure: "50000.00",
    available: "200000.00",
    updatedAt: null,
  },
  authorisations: [
    {
      authorisationId: "a1",
      userId: "agent",
      userName: "Tom Whitfield",
      saleId: null,
      saleTitle: null,
      bidLimit: "10000.00",
      total: { limit: "50000.00", exposure: "18000.00", available: "32000.00" },
    },
  ],
};

function org(role: LegalEntityMemberRole, extra: Partial<BiddingOrganisation> = {}) {
  return {
    name: "Northbank Gallery",
    status: "approved" as const,
    checkedAt: new Date("2026-03-14T10:00:00Z"),
    actor: { role },
    limits: LIMITS,
    biddersCount: 3,
    userId: role === "buyer_agent" ? "agent" : "me",
    ...extra,
  };
}

const ids = (rows: ReturnType<typeof biddingRows>) => rows.map((row) => row.id);

describe("Bid settings' Bidding card", () => {
  it("personal: your identity check and your limit, with a way to ask for more", () => {
    const rows = biddingRows("approved", null);
    expect(ids(rows)).toEqual(["identity", "limit"]);
    expect(rows[1]?.action).toMatchObject({ label: "Request a higher limit" });
  });

  it("owner: the organisation's check and date, its limit, who can bid; never their own identity", () => {
    const rows = biddingRows("pending", org("owner"));
    expect(ids(rows)).toEqual(["check", "limit", "who_can_bid"]);
    expect(rows[0]?.detail).toMatch(
      /^Northbank Gallery's documents were checked on 14\sMar\s2026\.$/,
    );
    expect(rows[1]?.value).toEqual({ kind: "figure", text: "£250,000", unit: "across open bids" });
    expect(rows[1]?.action).toMatchObject({ label: "Change limit", href: "/team/bidding" });
    expect(rows[2]).toMatchObject({
      value: { text: "3 members" },
      action: { label: "Manage in Members", href: "/team" },
    });
  });

  it("buyer agent: their own authorisation and identity check, and no way to change limits", () => {
    const rows = biddingRows("approved", org("buyer_agent"));
    expect(ids(rows)).toEqual(["check", "limit", "authorisation", "identity"]);
    expect(rows[1]?.action).toBeNull();
    expect(rows[2]?.value).toEqual({ kind: "figure", text: "£10,000", unit: "per lot" });
    expect(rows[2]?.detail).toContain("£50,000 in total, £32,000 left.");
  });

  it("a role that doesn't bid is told so, without limits it can't read", () => {
    for (const role of ["finance", "consignor", "viewer"] as const) {
      expect(ids(biddingRows("approved", org(role, { limits: null })))).toEqual(["check", "role"]);
    }
  });

  it("a restricted organisation says why, and an unread limit says so calmly", () => {
    const rows = biddingRows("approved", org("owner", { status: "restricted", limits: null }));
    expect(rows[0]?.value).toMatchObject({ kind: "badge", tone: "danger" });
    expect(rows[1]?.value).toEqual({ kind: "text", text: "Not available right now" });
  });

  it("no organisation limit: an owner can set one", () => {
    const rows = biddingRows(
      "approved",
      org("admin", {
        limits: {
          ...LIMITS,
          organisation: { ...LIMITS.organisation, limit: null, available: null },
        },
      }),
    );
    expect(rows[1]).toMatchObject({
      value: { text: "No organisation limit" },
      action: { label: "Set a limit" },
    });
  });
});
