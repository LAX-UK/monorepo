import { describe, expect, it } from "vitest";
import { buildShellConfig } from "./build-shell-config";
import { isNavGroup } from "./contracts";
import { navEntriesToFlatItems, navEntriesToGroups } from "./nav-adapters";

const clientUser = { role: "client" as const, staffRoles: [] };
const staffUser = { role: "staff" as const, staffRoles: ["super_admin"] as const };

describe("buildShellConfig", () => {
  it("builds flat nav for client role", () => {
    const config = buildShellConfig({ user: clientUser, role: "client" });
    expect(config.role).toBe("client");
    expect(config.nav.every((e) => !isNavGroup(e))).toBe(true);
    expect(config.mobileNav.length).toBeGreaterThan(0);
  });

  it("builds grouped nav for platform staff", () => {
    const config = buildShellConfig({ user: staffUser, role: "platform" });
    const groups = navEntriesToGroups(config.nav);
    expect(groups.length).toBeGreaterThan(0);
    expect(navEntriesToFlatItems(config.nav).length).toBeGreaterThan(groups.length);
    expect(config.mobileNav.length).toBeGreaterThan(0);
    expect(config.mobileNav.map((t) => t.id)).toEqual([
      "home",
      "sales",
      "lots",
      "submissions",
      "more",
    ]);
  });

  it("maps shell slots onto config", () => {
    const config = buildShellConfig({
      user: clientUser,
      role: "client",
      headerActionsSlot: <span>Actions</span>,
      headerExtraSlot: <span>Extra</span>,
      contextBanner: <span>Banner</span>,
      topSlot: <span>Top</span>,
    });
    expect(config.header.actionsSlot).toBeTruthy();
    expect(config.header.extraSlot).toBeTruthy();
    expect(config.contextBanner).toBeTruthy();
    expect(config.topSlot).toBeTruthy();
  });

  it("leaves Sold & payouts plain for someone who sells nothing", () => {
    const config = buildShellConfig({
      user: clientUser,
      role: "client",
      sellerConnectNavBadge: { connectEnforced: true, connectReady: false },
    });
    const payouts = config.nav.find((item) => !isNavGroup(item) && item.id === "payouts");
    expect(payouts).toBeUndefined();
  });

  it("flags Sold & payouts when payout setup is required but unfinished", () => {
    const config = buildShellConfig({
      user: clientUser,
      role: "client",
      clientNavScope: { context: { kind: "personal" }, hasSubmissions: true },
      sellerConnectNavBadge: { connectEnforced: true, connectReady: false },
    });
    const all = [...config.nav, ...(config.moreSheetNav ?? [])];
    const payouts = all.find((item) => !isNavGroup(item) && item.id === "payouts");
    expect(payouts && !isNavGroup(payouts) && payouts.badge).toBe(1);
    expect(payouts && !isNavGroup(payouts) && payouts.badgeTone).toBe("warning");
  });

  it("splits client more sheet nav from bottom tabs", () => {
    const config = buildShellConfig({
      user: clientUser,
      role: "client",
    });
    expect(config.mobileNav.map((t) => t.id)).toEqual([
      "bids",
      "purchases",
      "watchlist",
      "notifications",
      "more",
    ]);
    const tabIds = new Set(config.mobileNav.map((t) => t.id));
    if (config.moreSheetNav) {
      for (const entry of config.moreSheetNav) {
        if (!isNavGroup(entry)) {
          expect(tabIds.has(entry.id)).toBe(false);
        }
      }
    }
  });
});
