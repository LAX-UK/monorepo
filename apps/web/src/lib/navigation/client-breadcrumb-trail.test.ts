import {
  backTargetOf,
  buildClientBreadcrumbTrail,
  clientPhoneTitle,
  withRecordTitle,
} from "@/lib/navigation/client-breadcrumb-trail";
import { describe, expect, it } from "vitest";

function labels(pathname: string): string[] {
  return buildClientBreadcrumbTrail(pathname).map((i) => i.label);
}

describe("buildClientBreadcrumbTrail", () => {
  it("shows one crumb on top-level pages", () => {
    expect(buildClientBreadcrumbTrail("/purchases")).toEqual([{ label: "Purchases" }]);
    expect(buildClientBreadcrumbTrail("/settings")).toEqual([{ label: "Bid settings" }]);
  });

  it("gives the Organisation and Team tabs no trail, since tabs are siblings", () => {
    expect(labels("/organisation")).toEqual(["Organisation"]);
    expect(labels("/organisation/members")).toEqual(["Members"]);
    expect(labels("/organisation/payouts")).toEqual(["Payouts"]);
    expect(labels("/organisation/security")).toEqual(["Security"]);
    expect(labels("/team")).toEqual(["Team"]);
    expect(labels("/team/activity")).toEqual(["Team"]);
  });

  it("trails an offer to buy at the bidder's own bid back to the bids", () => {
    expect(buildClientBreadcrumbTrail("/bids/offers/o1")).toEqual([
      { label: "My bids", href: "/bids" },
      { label: "Your offer", record: true },
    ]);
  });

  it("names the Collection page as the menu does", () => {
    expect(labels("/collection")).toEqual(["Collection"]);
  });

  it("trails a purchase, its problem report and a payout to their lists", () => {
    expect(labels("/purchases/lot-1")).toEqual(["Purchases", "Purchase"]);
    expect(buildClientBreadcrumbTrail("/purchases/lot-1/report-problem")).toEqual([
      { label: "Purchases", href: "/purchases" },
      { label: "Purchase", href: "/purchases/lot-1" },
      { label: "Report a problem" },
    ]);
    expect(buildClientBreadcrumbTrail("/selling/payouts/po-1")[0]).toEqual({
      label: "Sold & payouts",
      href: "/selling/payouts?tab=payouts",
    });
  });

  it("labels invitation review and accept", () => {
    expect(labels("/organisations/invitations/review/inv-123")).toEqual([
      "Invitations",
      "Review invitation",
    ]);
    expect(labels("/organisations/invitations/accept/token-abc")).toEqual([
      "Invitations",
      "Accept invitation",
    ]);
  });

  it("labels a payout statement under Sold & payouts", () => {
    expect(labels("/legal-entities/le-1/payouts/po-1/statement")).toEqual([
      "Sold & payouts",
      "Statement",
    ]);
  });

  it("labels the Pay page and a consignment without raw ids", () => {
    expect(labels("/purchases/pay")).toEqual(["Purchases", "Pay"]);
    expect(labels("/selling/consignments/s1")).toEqual(["Consignments", "Consignment"]);
    expect(labels("/selling/new")).toEqual(["Consignments", "New submission"]);
  });

  it("trails the edit page back to its consignment", () => {
    expect(buildClientBreadcrumbTrail("/selling/consignments/s1/edit")).toEqual([
      { label: "Consignments", href: "/selling/consignments" },
      { label: "Consignment", href: "/selling/consignments/s1" },
      { label: "Make changes" },
    ]);
  });

  it("labels the Bid settings pages", () => {
    expect(buildClientBreadcrumbTrail("/settings/bidding")).toEqual([
      { label: "Bid settings", href: "/settings" },
      { label: "Bidding limits" },
    ]);
  });

  it("labels payout setup under Sold & payouts", () => {
    expect(labels("/selling/payout-setup")).toEqual(["Sold & payouts", "Payout setup"]);
  });

  it("never falls through to Detail on a client-area page", () => {
    for (const path of [
      "/home",
      "/bids/telephone/t1",
      "/collection",
      "/team/bidding",
      "/purchases/lot-1",
      "/selling/payouts/po-1",
      "/selling/artist",
      "/organisation/documents",
      "/settings/appearance",
      "/no-access",
      "/switch-account/confirm",
      "/switch-account/unavailable",
    ]) {
      expect(labels(path)).not.toContain("Detail");
    }
  });
});

describe("record pages", () => {
  it("title the current crumb with the record, and go back from the phone header", () => {
    const trail = buildClientBreadcrumbTrail("/selling/consignments/s1");
    expect(withRecordTitle(trail, "Thames at Battersea").map((i) => i.label)).toEqual([
      "Consignments",
      "Thames at Battersea",
    ]);
    expect(withRecordTitle(trail, null).map((i) => i.label)).toEqual([
      "Consignments",
      "Consignment",
    ]);
    expect(clientPhoneTitle(trail, "Thames at Battersea")).toEqual({
      title: "Thames at Battersea",
      backHref: "/selling/consignments",
      backLabel: "Consignments",
    });
  });
});

describe("the way back", () => {
  const back = (pathname: string) => backTargetOf(buildClientBreadcrumbTrail(pathname));

  it("is the parent list on a detail page, named as the menu names it", () => {
    expect(back("/purchases/lot-1")).toEqual({ label: "Purchases", href: "/purchases" });
    expect(back("/selling/consignments/s1")).toEqual({
      label: "Consignments",
      href: "/selling/consignments",
    });
    expect(back("/selling/payout-setup")?.label).toBe("Sold & payouts");
    expect(back("/settings/bidding")).toEqual({ label: "Bid settings", href: "/settings" });
  });

  it("goes up one level from a page two deep", () => {
    expect(back("/selling/consignments/s1/edit")).toEqual({
      label: "Consignment",
      href: "/selling/consignments/s1",
    });
  });

  it("is absent on menu pages and tabs", () => {
    for (const path of [
      "/home",
      "/collection",
      "/purchases",
      "/team/activity",
      "/organisation/members",
    ]) {
      expect(back(path)).toBeNull();
    }
  });

  it("puts the arrow and the title in the phone bar on every detail page, and neither on a menu page", () => {
    const phone = (pathname: string) =>
      clientPhoneTitle(buildClientBreadcrumbTrail(pathname), null);
    expect(phone("/selling/new")).toEqual({
      title: "New submission",
      backHref: "/selling/consignments",
      backLabel: "Consignments",
    });
    expect(phone("/purchases/lot-1/report-problem")).toMatchObject({
      title: "Report a problem",
      backHref: "/purchases/lot-1",
    });
    expect(phone("/collection")).toEqual({ title: "Collection" });
  });
});
