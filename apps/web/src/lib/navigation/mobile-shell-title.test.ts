import { resolveMobileShellTitle } from "@/lib/navigation/mobile-shell-title";
import { describe, expect, it } from "vitest";

describe("resolveMobileShellTitle", () => {
  it("returns overview title for a single root item", () => {
    expect(resolveMobileShellTitle([{ label: "Dashboard" }])).toEqual({
      title: "Dashboard",
    });
  });

  it("returns section title only for section root routes", () => {
    expect(
      resolveMobileShellTitle([{ label: "Dashboard", href: "/dashboard" }, { label: "Watchlist" }]),
    ).toEqual({
      title: "Watchlist",
    });
  });

  it("returns back link and title for nested routes", () => {
    expect(
      resolveMobileShellTitle([
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: "Profile" },
      ]),
    ).toEqual({
      title: "Profile",
      backHref: "/dashboard/settings",
      backLabel: "Settings",
      eyebrow: "Settings",
    });
  });
});
