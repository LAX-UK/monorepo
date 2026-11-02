import {
  buildClientBreadcrumbTrail,
  withRecordTitle,
} from "@/lib/navigation/client-breadcrumb-trail";
import { resolveMobileShellTitle } from "@/lib/navigation/mobile-shell-title";
import { describe, expect, it } from "vitest";

function labels(pathname: string): string[] {
  return buildClientBreadcrumbTrail(pathname).map((i) => i.label);
}

describe("buildClientBreadcrumbTrail", () => {
  it("shows one crumb on top-level pages", () => {
    expect(buildClientBreadcrumbTrail("/purchases")).toEqual([{ label: "Purchases" }]);
    expect(buildClientBreadcrumbTrail("/settings")).toEqual([{ label: "Bid settings" }]);
  });

  it("labels the Organisation page and its tabs, with no id in the address", () => {
    expect(labels("/organisation")).toEqual(["Organisation"]);
    expect(buildClientBreadcrumbTrail("/organisation/members")).toEqual([
      { label: "Organisation", href: "/organisation" },
      { label: "Members" },
    ]);
    expect(labels("/organisation/payouts")).toEqual(["Organisation", "Payouts"]);
    expect(labels("/organisation/security")).toEqual(["Organisation", "Security"]);
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

  it("labels checkout and a consignment without raw ids", () => {
    expect(labels("/purchases/checkout/lot-abc")).toEqual(["Purchases", "Checkout"]);
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
      "/selling/works",
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
    expect(resolveMobileShellTitle(withRecordTitle(trail, "Thames at Battersea"))).toEqual({
      title: "Thames at Battersea",
      backHref: "/selling/consignments",
      backLabel: "Consignments",
    });
  });
});
