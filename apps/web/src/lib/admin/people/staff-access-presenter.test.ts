import { describe, expect, it } from "vitest";
import { staffPlatformBadges, twoFactorStatusLabel } from "./staff-access-presenter";

describe("staff access presenter", () => {
  it("labels each held platform in catalogue order", () => {
    expect(
      staffPlatformBadges([
        { product: "shop", role: "broker" },
        { product: "bid", role: "administrator" },
      ]),
    ).toEqual([
      { product: "bid", label: "Bid · Administrator" },
      { product: "shop", label: "LAX Admin · Broker" },
    ]);
  });

  it("falls back to a readable role name when the catalogue does not know it", () => {
    expect(staffPlatformBadges([{ product: "shop", role: "legacy_role" }])).toEqual([
      { product: "shop", label: "LAX Admin · legacy role" },
    ]);
  });

  it("separates unknown 2FA state from off", () => {
    expect([true, false, null].map(twoFactorStatusLabel)).toEqual(["On", "Off", "Unknown"]);
  });
});
