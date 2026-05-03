import { describe, expect, it } from "vitest";
import { artistPath, lotPath, salePath, slugify } from "./url";

describe("slugify", () => {
  it("keeps lowercase ASCII words and digits separated by hyphens", () => {
    expect(slugify("Lot 42: Modern Study")).toBe("lot-42-modern-study");
  });

  it("folds accents and removes apostrophes", () => {
    expect(slugify("Picasso's Étude pour l’artiste")).toBe("picassos-etude-pour-lartiste");
  });

  it("collapses repeated whitespace and punctuation", () => {
    expect(slugify("  Jean--Michel   Basquiat / Untitled!!! ")).toBe(
      "jean-michel-basquiat-untitled",
    );
  });

  it("truncates at a word boundary", () => {
    expect(slugify("one two three four five", { maxLength: 15 })).toBe("one-two-three");
  });

  it("falls back when all characters are stripped", () => {
    expect(slugify("----")).toBe("untitled");
  });

  it("builds canonical entity paths", () => {
    expect(lotPath({ id: "lot-id", title: "Memory Garden" })).toBe("/artwork/memory-garden/lot-id");
    expect(salePath({ id: "sale-id", title: "Evening Sale" })).toBe("/sales/evening-sale/sale-id");
    expect(artistPath({ id: "artist-id", name: "Stanley Whitney" })).toBe(
      "/artist/stanley-whitney/artist-id",
    );
  });
});
