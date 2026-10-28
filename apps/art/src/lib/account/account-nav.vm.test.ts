import { describe, expect, it } from "vitest";
import {
  buildArtAccountDestinations,
  buildArtAccountTabs,
  buildArtFavouritesTabs,
} from "./account-nav.vm.js";

const laxAccountUrl = (page: string) => `https://account.test/${page}`;

describe("account tabs", () => {
  it("lists Overview and Enquiries as route tabs and marks the active one", () => {
    expect(buildArtAccountTabs("/account/enquiries")).toEqual([
      { id: "overview", href: "/account", label: "Overview", active: false },
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

describe("buildArtAccountDestinations", () => {
  it("gives a plain collector lax.art's own pages and LAX Account, never Collection or Payouts", () => {
    const rows = buildArtAccountDestinations({
      capabilities: { receivesPayouts: "no" },
      laxAccountUrl,
    });
    expect(rows.map((row) => [row.id, row.href, row.external])).toEqual([
      ["favourites", "/account/favourites", false],
      ["following", "/account/favourites/follows", false],
      ["lax-account", "https://account.test/home", true],
    ]);
    expect(rows.map((row) => row.href)).not.toContain("/account/collection");
  });

  it("adds Payouts in LAX Account for a payee only", () => {
    const rows = buildArtAccountDestinations({
      capabilities: { receivesPayouts: "yes" },
      laxAccountUrl,
    });
    expect(rows.find((row) => row.id === "payouts")).toMatchObject({
      title: "Payouts",
      href: "https://account.test/sellingPayouts",
      external: true,
    });
  });

  it("does not offer Payouts when the seller lookup failed", () => {
    const rows = buildArtAccountDestinations({
      capabilities: { receivesPayouts: "unknown" },
      laxAccountUrl,
    });
    expect(rows.map((row) => row.id)).not.toContain("payouts");
  });

  it("shows known counts and leaves unknown ones blank", () => {
    const rows = buildArtAccountDestinations({
      capabilities: { receivesPayouts: "no" },
      laxAccountUrl,
      counts: { favourites: 3, following: undefined },
    });
    expect(rows.map((row) => row.countLabel)).toEqual(["3", null, null]);
  });
});
