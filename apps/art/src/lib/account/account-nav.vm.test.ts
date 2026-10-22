import { describe, expect, it } from "vitest";
import {
  buildArtAccountSecondaryLinks,
  buildArtAccountTabs,
  buildArtFavouritesTabs,
} from "./account-nav.vm.js";

describe("account tabs", () => {
  it("lists Profile and Enquiries as route tabs and marks the active one", () => {
    expect(buildArtAccountTabs("/account/enquiries")).toEqual([
      { id: "profile", href: "/account", label: "Profile", active: false },
      { id: "enquiries", href: "/account/enquiries", label: "Enquiries", active: true },
    ]);
  });
});

describe("favourites tabs", () => {
  it("uses separate routes for Saves and Follows", () => {
    expect(buildArtFavouritesTabs("/account/favourites/follows")).toEqual([
      { id: "saves", href: "/account/favourites", label: "Saves", active: false },
      { id: "follows", href: "/account/favourites/follows", label: "Follows", active: true },
    ]);
  });
});

describe("buildArtAccountSecondaryLinks", () => {
  it("keeps collection and favourites reachable without payouts by default", () => {
    expect(buildArtAccountSecondaryLinks({ payoutsEnabled: false }).map((l) => l.href)).toEqual([
      "/account/collection",
      "/account/favourites",
    ]);
  });

  it("adds payouts only when the flag is on", () => {
    expect(buildArtAccountSecondaryLinks({ payoutsEnabled: true }).at(-1)).toEqual({
      href: "/account/payouts",
      label: "Payouts",
    });
  });
});
