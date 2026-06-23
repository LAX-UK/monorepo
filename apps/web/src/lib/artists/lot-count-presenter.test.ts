import { formatArtistLotsLabel } from "@/lib/artists/lot-count-presenter";
import { describe, expect, it } from "vitest";

describe("formatArtistLotsLabel", () => {
  it("uses singular for one lot", () => {
    expect(formatArtistLotsLabel(1)).toBe("1 lot");
  });

  it("uses plural for multiple lots", () => {
    expect(formatArtistLotsLabel(4)).toBe("4 lots");
  });

  it("uses plural for zero (callers should hide the label)", () => {
    expect(formatArtistLotsLabel(0)).toBe("0 lots");
  });
});
