import { LayoutGrid } from "lucide-react";
import { describe, expect, it } from "vitest";
import { applySellerConnectNavBadges } from "./apply-seller-connect-nav-badges";
import type { NavItem } from "./contracts";

const items: NavItem[] = [
  {
    id: "consignments",
    href: "/selling/consignments",
    label: "Consignments",
    icon: LayoutGrid,
  },
  {
    id: "payouts",
    href: "/selling/payouts",
    label: "Sold & payouts",
    icon: LayoutGrid,
  },
];

describe("applySellerConnectNavBadges", () => {
  it("flags Sold & payouts, where payout setup is reached, when it is not ready", () => {
    const out = applySellerConnectNavBadges(items, {
      connectEnforced: true,
      connectReady: false,
    });
    expect(out.find((i) => i.id === "payouts")?.badge).toBe(1);
    expect(out.find((i) => i.id === "payouts")?.badgeTone).toBe("warning");
    expect(out.find((i) => i.id === "consignments")?.badge).toBeUndefined();
  });

  it("skips badge when connect is ready", () => {
    const out = applySellerConnectNavBadges(items, {
      connectEnforced: true,
      connectReady: true,
    });
    expect(out.find((i) => i.id === "payouts")?.badge).toBeUndefined();
  });

  it("skips badge when connect is not enforced", () => {
    const out = applySellerConnectNavBadges(items, {
      connectEnforced: false,
      connectReady: false,
    });
    expect(out.find((i) => i.id === "payouts")?.badge).toBeUndefined();
  });
});
