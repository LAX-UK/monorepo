import { describe, expect, it } from "vitest";
import { lotCardBidAction } from "./lot-card-bid-action";

const online = { status: "scheduled", deliveryMode: "online" } as const;
const lotHref = "/lot/still-life/lot-1";
const registered = { signedIn: true, register: null };
const mustRegister = { signedIn: true, register: { href: "#register-to-bid" } };

describe("lotCardBidAction", () => {
  it("says Bid on an open lot, whoever is looking", () => {
    for (const viewer of [null, registered, mustRegister]) {
      expect(lotCardBidAction({ lotStatus: "active", lotHref, sale: online, viewer })).toEqual({
        kind: "bid",
        label: "Bid",
        href: lotHref,
      });
    }
  });

  it("says Register to bid before opening for a viewer with a register step", () => {
    expect(
      lotCardBidAction({ lotStatus: "scheduled", lotHref, sale: online, viewer: mustRegister }),
    ).toEqual({ kind: "register", label: "Register to bid", href: "#register-to-bid" });
    const signedOut = { signedIn: false, register: { href: "/login?intent=signup" } };
    expect(
      lotCardBidAction({ lotStatus: "draft", lotHref, sale: online, viewer: signedOut }),
    ).toMatchObject({ kind: "register", label: "Register to bid" });
  });

  it("says Leave a bid before opening for a registered viewer when advance bids are taken", () => {
    expect(
      lotCardBidAction({ lotStatus: "scheduled", lotHref, sale: online, viewer: registered }),
    ).toEqual({ kind: "leave_bid", label: "Leave a bid", href: lotHref });
    const hybridOpenEarly = {
      status: "active",
      deliveryMode: "hybrid",
      allowOnlineBidsBeforeGoLive: true,
    } as const;
    expect(
      lotCardBidAction({
        lotStatus: "scheduled",
        lotHref,
        sale: hybridOpenEarly,
        viewer: registered,
      }),
    ).toMatchObject({ kind: "leave_bid" });
  });

  it("never offers a bid the lot would refuse before it opens", () => {
    const gated = { status: "scheduled", deliveryMode: "hybrid" } as const;
    const onsite = { status: "scheduled", deliveryMode: "onsite" } as const;
    const draftSale = { status: "draft", deliveryMode: "online" } as const;
    for (const sale of [gated, onsite, draftSale, null]) {
      expect(lotCardBidAction({ lotStatus: "scheduled", lotHref, sale, viewer: registered })).toBe(
        null,
      );
    }
    // A preview lot (not scheduled yet) takes no maximum either.
    expect(
      lotCardBidAction({ lotStatus: "draft", lotHref, sale: online, viewer: registered }),
    ).toBe(null);
  });

  it("keeps the place while the viewer is unknown, and shows nothing on a result", () => {
    expect(
      lotCardBidAction({ lotStatus: "scheduled", lotHref, sale: online, viewer: null }),
    ).toEqual({ kind: "pending" });
    for (const lotStatus of ["ended", "cancelled", "voided"] as const) {
      expect(lotCardBidAction({ lotStatus, lotHref, sale: online, viewer: registered })).toBe(null);
    }
  });
});
