import { describe, expect, it } from "vitest";
import { type BiddingOrganisation, biddingStanding } from "./bidding-standing";

describe("biddingStanding", () => {
  it("asks an unverified person to verify, then always offers a limit increase", () => {
    const [identity, limit] = biddingStanding(undefined);
    expect(identity).toMatchObject({
      title: "Verify your identity",
      action: { label: "Verify identity", href: "/verify-identity" },
    });
    expect(limit?.action?.href).toBe("/contact?intent=bidding-limit");
  });

  it("offers nothing to do once verified or while checking", () => {
    expect(biddingStanding("approved")[0]?.action).toBeNull();
    expect(biddingStanding("pending")[0]?.title).toBe("We're checking your identity");
  });
});

describe("biddingStanding for an organisation", () => {
  const acting = (role: BiddingOrganisation["role"], status: BiddingOrganisation["status"]) => ({
    name: "Acme Art",
    status,
    role,
  });

  it("never shows the person's identity check to an owner of an approved organisation", () => {
    const rows = biddingStanding("pending", acting("owner", "approved"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "organisation", title: "Acme Art is approved to bid" });
    expect(rows[0]?.detail).toMatch(/no limit/i);
  });

  it("explains an organisation that cannot bid yet, from its state", () => {
    const [row] = biddingStanding("approved", acting("admin", "under_review"));
    expect(row).toMatchObject({ id: "organisation", title: "Bidding for Acme Art isn't open yet" });
  });

  it("offers contact when the organisation is paused", () => {
    const [row] = biddingStanding(undefined, acting("owner", "restricted"));
    expect(row).toMatchObject({ title: "Bidding for Acme Art is paused" });
    expect(row?.action?.label).toBe("Contact us");
  });

  it("tells a role that does not bid, without an identity row", () => {
    const rows = biddingStanding("pending", acting("finance", "approved"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("You don't bid for Acme Art");
  });

  it("keeps a buyer agent's own identity check, because they bid in their own name", () => {
    const rows = biddingStanding("pending", acting("buyer_agent", "approved"));
    expect(rows.map((row) => row.id)).toEqual(["organisation", "identity"]);
    expect(rows[1]?.title).toBe("We're checking your identity");
  });
});
