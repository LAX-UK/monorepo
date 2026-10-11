import { describe, expect, it } from "vitest";
import { buildArtAccountNavItems } from "./account-nav.vm.js";

describe("buildArtAccountNavItems", () => {
  it("lists lax.art account tabs without payouts by default", () => {
    expect(
      buildArtAccountNavItems({ payoutsEnabled: false, activeHref: "/account/favorites" }),
    ).toEqual([
      { href: "/account", label: "Profile", active: false },
      { href: "/account/inquiries", label: "Inquiries", active: false },
      { href: "/account/collection", label: "Collection", active: false },
      { href: "/account/favorites", label: "Favorites", active: true },
    ]);
  });

  it("adds payouts only when the flag is on", () => {
    const items = buildArtAccountNavItems({ payoutsEnabled: true, activeHref: "/account" });
    expect(items.at(-1)).toEqual({ href: "/account/payouts", label: "Payouts", active: false });
  });
});
