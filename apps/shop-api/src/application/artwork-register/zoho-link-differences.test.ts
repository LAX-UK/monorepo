import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import { type ArtistForCode, type LinkListingFacts, planLink } from "./zoho-link-differences.js";

const T0 = new Date("2026-11-03T09:00:00.000Z");

const entry = (patch: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry => ({
  id: "2f0b6d7e-0000-4000-8000-000000000001",
  zohoProductId: "5001",
  stockCode: "LAX-ORI-AR-TM-26-0004",
  kind: "original",
  sourceOriginalId: null,
  title: "Tidal margin IV",
  artist: { zohoArtistId: "77", name: "Ada Rowe", code: "AR" },
  medium: "Oil on linen",
  dimensions: "90 × 120 cm",
  year: 2024,
  imageRefs: ["a.jpg", "b.jpg"],
  catalogueStatus: "Available",
  offer: { state: "held", ref: null },
  zohoModifiedAt: T0,
  createdAt: T0,
  updatedAt: T0,
  version: 1,
  ...patch,
});

const listing = (patch: Partial<LinkListingFacts> = {}): LinkListingFacts => ({
  title: "Tidal margin IV",
  artistId: "artist-1",
  artistName: "Ada Rowe",
  artistCode: "AR",
  medium: "Oil on linen",
  dimensions: "90 × 120 cm",
  year: 2024,
  imageKeys: ["a.jpg", "b.jpg"],
  ...patch,
});

const ada: ArtistForCode = { artistId: "artist-1", displayName: "Ada Rowe", archived: false };

describe("planLink", () => {
  it("changes nothing when lax.art and Zoho agree", () => {
    const plan = planLink(listing(), entry(), ada);
    expect(plan).toEqual({ differences: [], update: {}, artistRefusal: null, replaced: [] });
  });

  it("replaces each differing value with Zoho's and shows lax.art's beside it", () => {
    const plan = planLink(
      listing({ title: "Tidal Margin 4", medium: "Oil", dimensions: "80 x 100", year: 2023 }),
      entry(),
      ada,
    );
    expect(plan.differences).toEqual([
      {
        field: "title",
        label: "Title",
        zohoValue: "Tidal margin IV",
        laxArtValue: "Tidal Margin 4",
      },
      { field: "medium", label: "Medium", zohoValue: "Oil on linen", laxArtValue: "Oil" },
      { field: "size", label: "Size", zohoValue: "90 × 120 cm", laxArtValue: "80 x 100" },
      { field: "year", label: "Year", zohoValue: "2024", laxArtValue: "2023" },
    ]);
    expect(plan.update).toEqual({
      title: "Tidal margin IV",
      medium: "Oil on linen",
      dimensions: "90 × 120 cm",
      yearCreated: 2024,
    });
    expect(plan.replaced).toEqual(["title", "medium", "size", "year"]);
  });

  it("never changes the web address, whatever differs", () => {
    const plan = planLink(listing({ title: "Other" }), entry(), ada);
    expect(Object.keys(plan.update)).not.toContain("slug");
  });

  it("takes a value Zoho leaves empty, as the nightly sync would", () => {
    const plan = planLink(listing(), entry({ medium: null, dimensions: " ", year: null }), ada);
    expect(plan.update).toEqual({ medium: null, dimensions: null, yearCreated: null });
    expect(plan.differences.map((d) => d.zohoValue)).toEqual([null, null, null]);
  });

  it("replaces the images when the lists differ, saying how many each side has", () => {
    const plan = planLink(listing({ imageKeys: ["old.jpg"] }), entry(), ada);
    expect(plan.differences).toEqual([
      { field: "images", label: "Images", zohoValue: "2 images", laxArtValue: "1 image" },
    ]);
    expect(plan.update.images).toEqual(["a.jpg", "b.jpg"]);
  });

  it("does not see a difference in images that are the same in the same order", () => {
    expect(
      planLink(listing(), entry({ imageRefs: ["a.jpg", "a.jpg", "b.jpg"] }), ada).update,
    ).toEqual({});
  });

  it("moves the artwork to the artist that carries Zoho's code", () => {
    const other: ArtistForCode = { artistId: "artist-2", displayName: "Ada Rowe", archived: false };
    const plan = planLink(
      listing({ artistId: "artist-9", artistName: "A. Rowe", artistCode: "XX" }),
      entry(),
      other,
    );
    expect(plan.differences).toEqual([
      { field: "artist", label: "Artist", zohoValue: "Ada Rowe", laxArtValue: "A. Rowe" },
    ]);
    expect(plan.update.artistId).toBe("artist-2");
  });

  it("gives Zoho's code to the listing's own artist when it is the same person with no code", () => {
    const plan = planLink(listing({ artistCode: null, artistName: "ADA  Rowe" }), entry(), null);
    expect(plan.update.claimArtistCode).toBe("AR");
    expect(plan.differences).toEqual([]);
    expect(plan.artistRefusal).toBeNull();
  });

  it("refuses when no artist carries the code and the names do not agree", () => {
    const plan = planLink(listing({ artistCode: null, artistName: "Bob Day" }), entry(), null);
    expect(plan.artistRefusal).toMatch(/No lax\.art artist has Zoho artist code AR/);
  });

  it("refuses when the artist that carries the code is archived", () => {
    const plan = planLink(listing({ artistCode: null }), entry(), {
      artistId: "artist-2",
      displayName: "Ada Rowe",
      archived: true,
    });
    expect(plan.artistRefusal).toMatch(/archived/);
  });

  it("is the same plan every time", () => {
    const input = [listing({ title: "x" }), entry(), ada] as const;
    expect(planLink(...input)).toEqual(planLink(...input));
  });
});
