import { describe, expect, it } from "vitest";
import {
  pendingChangeLabel,
  staffPlatformBadges,
  twoFactorStatusLabel,
} from "./staff-access-presenter";

describe("staff access presenter", () => {
  it("labels each held platform in catalogue order", () => {
    expect(
      staffPlatformBadges([
        { product: "shop", role: "broker" },
        { product: "bid", role: "super_admin" },
      ]),
    ).toEqual([
      { product: "bid", label: "Bid · Super admin" },
      { product: "shop", label: "Shop · Broker" },
    ]);
  });

  it("falls back to a readable role name when the catalogue does not know it", () => {
    expect(staffPlatformBadges([{ product: "shop", role: "legacy_role" }])).toEqual([
      { product: "shop", label: "Shop · legacy role" },
    ]);
  });

  it("separates unknown 2FA state from off", () => {
    expect([true, false, null].map(twoFactorStatusLabel)).toEqual(["On", "Off", "Unknown"]);
  });

  it("describes pending grants and removals", () => {
    expect(pendingChangeLabel("shop", { action: "granted", role: "finance" })).toBe(
      "Finance waiting for Shop to apply it",
    );
    expect(pendingChangeLabel("shop", { action: "revoked", role: null })).toBe(
      "Removal waiting for Shop to apply it",
    );
  });
});
