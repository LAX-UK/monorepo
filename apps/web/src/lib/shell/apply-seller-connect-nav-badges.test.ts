import { LayoutGrid } from "lucide-react";
import { describe, expect, it } from "vitest";
import { applySellerConnectNavBadges } from "./apply-seller-connect-nav-badges";
import type { NavItem } from "./contracts";

const items: NavItem[] = [
  {
    id: "connect",
    href: "/dashboard/seller/connect",
    label: "Payout setup",
    icon: LayoutGrid,
  },
  {
    id: "payouts",
    href: "/dashboard/seller/payouts",
    label: "Sold & payouts",
    icon: LayoutGrid,
  },
];

describe("applySellerConnectNavBadges", () => {
  it("adds warning badge on connect when not ready", () => {
    const out = applySellerConnectNavBadges(items, {
      connectEnforced: true,
      connectReady: false,
    });
    expect(out.find((i) => i.id === "connect")?.badge).toBe(1);
    expect(out.find((i) => i.id === "connect")?.badgeTone).toBe("warning");
    expect(out.find((i) => i.id === "payouts")?.badge).toBeUndefined();
  });

  it("skips badge when connect is ready", () => {
    const out = applySellerConnectNavBadges(items, {
      connectEnforced: true,
      connectReady: true,
    });
    expect(out.find((i) => i.id === "connect")?.badge).toBeUndefined();
  });

  it("skips badge when connect is not enforced", () => {
    const out = applySellerConnectNavBadges(items, {
      connectEnforced: false,
      connectReady: false,
    });
    expect(out.find((i) => i.id === "connect")?.badge).toBeUndefined();
  });
});
