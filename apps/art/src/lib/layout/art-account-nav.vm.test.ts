import { describe, expect, it } from "vitest";
import {
  ART_ACCOUNT_LINKS,
  artAccountDisplayName,
  artAccountInitials,
  buildArtMobileAccountLinks,
} from "./art-account-nav.vm.js";

describe("art account navigation view model", () => {
  it("lists favorites, inquiries, and collection for the desktop menu", () => {
    expect(ART_ACCOUNT_LINKS.map((link) => link.label)).toEqual([
      "Favorites",
      "Inquiries",
      "Collection",
    ]);
  });

  it("puts My account first in the drawer list", () => {
    expect(buildArtMobileAccountLinks("/account", "/").map((link) => link.label)).toEqual([
      "My account",
      "Favorites",
      "Inquiries",
      "Collection",
    ]);
  });

  it.each([
    ["/account", ["My account"]],
    ["/account/favorites", ["Favorites"]],
    ["/account/inquiries/abc", ["Inquiries"]],
    ["/account/payouts", []],
    ["/artworks", []],
  ] as const)("marks %s as current: %j", (pathname, expected) => {
    const current = buildArtMobileAccountLinks("/account", pathname)
      .filter((link) => link.current)
      .map((link) => link.label);
    expect(current).toEqual(expected);
  });

  it.each([
    ["Ada Lovelace", "ada@example.com", "AL"],
    ["  cher  ", "cher@example.com", "C"],
    ["Mary Ann Evans", "", "ME"],
    ["", "zoe@example.com", "Z"],
    ["", "", "?"],
  ] as const)("derives initials from %j / %j", (displayName, email, expected) => {
    expect(artAccountInitials(displayName, email)).toBe(expected);
  });

  it("falls back to a neutral label when the profile has no name", () => {
    expect(artAccountDisplayName("  ")).toBe("Signed in");
    expect(artAccountDisplayName(" Ada ")).toBe("Ada");
  });
});
