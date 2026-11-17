import { salePrimaryViewerAction } from "@/lib/sale/sale-primary-viewer-action";
import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { lotCardBidAction } from "./lot-card-bid-action";

const online = { status: "scheduled", deliveryMode: "online" } as const;
const lotHref = "/lot/still-life/lot-1";
const registered = { signedIn: true, register: null };
const mustRegister = {
  signedIn: true,
  register: { href: "#register-to-bid", label: "Register to bid" },
};

/** The sale page's register step for a signed-in viewer, from the hero's own presenter. */
function heroStep(viewer: {
  kycApproved: boolean;
  buyerEntities: { memberRole: LegalEntityMemberRole }[];
}) {
  const step = salePrimaryViewerAction({
    saleHref: "/sales/spring/sale-1",
    isAuthenticated: true,
    kycApproved: viewer.kycApproved,
    buyerEntities: viewer.buyerEntities,
    status: "scheduled",
    deliveryMode: "online",
    registrationOffered: true,
    hasApprovedRegistration: false,
  });
  if (!step) throw new Error("expected a register step");
  return { signedIn: true, register: { href: step.href, label: step.label } };
}

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
    const signedOut = {
      signedIn: false,
      register: { href: "/login?intent=signup", label: "Register to bid" },
    };
    expect(
      lotCardBidAction({ lotStatus: "draft", lotHref, sale: online, viewer: signedOut }),
    ).toMatchObject({ kind: "register", label: "Register to bid" });
  });

  it("names an identity check exactly as the hero does, with the hero's link", () => {
    const viewer = heroStep({ kycApproved: false, buyerEntities: [] });
    expect(viewer.register.label).toBe("Verify identity to bid");
    expect(lotCardBidAction({ lotStatus: "scheduled", lotHref, sale: online, viewer })).toEqual({
      kind: "register",
      label: "Verify identity to bid",
      href: viewer.register.href,
    });
  });

  it("names a missing buyer profile exactly as the hero does, with the hero's link", () => {
    const viewer = heroStep({ kycApproved: true, buyerEntities: [] });
    expect(lotCardBidAction({ lotStatus: "scheduled", lotHref, sale: online, viewer })).toEqual({
      kind: "register",
      label: "Set up a buyer profile",
      href: "/onboarding/organisation",
    });
  });

  it("says Register to bid only when the step is registration", () => {
    const viewer = heroStep({ kycApproved: true, buyerEntities: [{ memberRole: "buyer_agent" }] });
    expect(lotCardBidAction({ lotStatus: "scheduled", lotHref, sale: online, viewer })).toEqual({
      kind: "register",
      label: "Register to bid",
      href: "#register-to-bid",
    });
  });

  it("says Leave a bid before opening for a registered viewer when advance bids are taken", () => {
    expect(
      lotCardBidAction({ lotStatus: "scheduled", lotHref, sale: online, viewer: registered }),
    ).toEqual({ kind: "leave_bid", label: "Leave a bid", href: `${lotHref}?bid=open` });
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

  it("draws no placeholder on a sale that could never offer a button before the lot opens", () => {
    const gated = { status: "scheduled", deliveryMode: "hybrid" } as const;
    const onsite = { status: "scheduled", deliveryMode: "onsite" } as const;
    const noRegistration = { ...online, registrationOffered: false, status: "draft" } as const;
    for (const sale of [onsite, noRegistration, null]) {
      expect(lotCardBidAction({ lotStatus: "scheduled", lotHref, sale, viewer: null })).toBe(null);
    }
    // A gated hybrid sale may still ask someone to register, so its place is kept.
    expect(
      lotCardBidAction({ lotStatus: "scheduled", lotHref, sale: gated, viewer: null }),
    ).toEqual({ kind: "pending" });
  });

  it("offers only Bid on an open lot where the sale is not known (search, home, artist)", () => {
    expect(
      lotCardBidAction({ lotStatus: "active", lotHref, sale: null, viewer: null }),
    ).toMatchObject({ kind: "bid", label: "Bid" });
    for (const lotStatus of ["scheduled", "draft", "ended"] as const) {
      expect(lotCardBidAction({ lotStatus, lotHref, sale: null, viewer: null })).toBe(null);
    }
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
