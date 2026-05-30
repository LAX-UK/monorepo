import { describe, expect, it } from "vitest";
import { buildShellConfig } from "./build-shell-config";
import { isNavGroup } from "./contracts";
import { navEntriesToFlatItems, navEntriesToGroups } from "./nav-adapters";

const clientUser = { role: "client" as const, staffRole: null };
const staffUser = { role: "staff" as const, staffRole: "super_admin" as const };

describe("buildShellConfig", () => {
  it("builds flat nav for client role", () => {
    const config = buildShellConfig({ user: clientUser, role: "client" });
    expect(config.role).toBe("client");
    expect(config.nav.every((e) => !isNavGroup(e))).toBe(true);
    expect(config.mobileNav.length).toBeGreaterThan(0);
    expect(config.clientWorkspaceMode).toBe("buying");
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
      headerRightSlot: <span>Right</span>,
      contextBanner: <span>Banner</span>,
      topSlot: <span>Top</span>,
    });
    expect(config.header.rightSlot).toBeTruthy();
    expect(config.contextBanner).toBeTruthy();
    expect(config.topSlot).toBeTruthy();
  });

  it("splits client more sheet nav from bottom tabs", () => {
    const config = buildShellConfig({
      user: clientUser,
      role: "client",
      clientWorkspaceMode: "buying",
    });
    expect(config.mobileNav.map((t) => t.id)).toEqual([
      "overview",
      "bids",
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
